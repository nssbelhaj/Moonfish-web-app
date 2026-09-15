import { describe, expect, it } from 'vitest';

import { diagnostiquer, verdictGlobal, type Environnement } from '../etat';

/*
  ────────────────────────────────────────────────────────────────────────────
   Ce diagnostic existe pour être LU — donc copié dans un message, collé dans
   une conversation, laissé dans un historique de terminal. Tout ce qu'il
   écrit doit pouvoir être vu par quelqu'un d'autre sans conséquence.

   Le test qui compte est le premier : on injecte des secrets reconnaissables
   et on échoue si l'un d'eux réapparaît, où que ce soit dans la sortie. Sans
   lui, il suffirait qu'un jour quelqu'un ajoute « pour vous aider à la
   relire, voici la valeur lue » pour publier un mot de passe de base.
  ────────────────────────────────────────────────────────────────────────────
*/

const CONTEXTE = {
  spotSlugs: ['pen-hat', 'la-torche', 'etretat', 'taghazout'],
  buildStamp: '2026-09-11T08:00:00Z',
  spotCount: 42,
  uploadsDir: '/var/photos',
  appDir: '/app',
};

/** Des secrets impossibles à confondre avec autre chose. */
const SECRETS = {
  motDePasseBase: 'MotDePasseBaseTresSecret',
  motDePasseSmtp: 'MotDePasseSmtpTresSecret',
  cleStormglass: 'CleStormglassTresSecrete',
  secretAuth: 'SecretAuthTresSecret',
  secretCron: 'SecretCronTresSecret',
};

const COMPLET: Environnement = {
  NODE_ENV: 'production',
  NEXT_PUBLIC_SITE_URL: 'https://lunamarea.fr',
  // Identifiant RÉALISTE : « utilisateur » est justement le mot d’exemple
  // que le détecteur de gabarits refuse, et la fixture le déclenchait.
  DATABASE_URL: `mysql://u969082232_luna:${SECRETS.motDePasseBase}@mysql.hostinger.com:3306/u969082232_moonfish`,
  EMAIL_SERVER: `smtp://contact%40lunamarea.fr:${SECRETS.motDePasseSmtp}@smtp.hostinger.com:587`,
  EMAIL_FROM: 'contact@lunamarea.fr',
  AUTH_URL: 'https://lunamarea.fr',
  AUTH_SECRET: SECRETS.secretAuth,
  STORMGLASS_API_KEY: SECRETS.cleStormglass,
  TIDE_REAL_SPOTS: 'pen-hat,la-torche,etretat',
  CRON_SECRET: SECRETS.secretCron,
};

describe('le diagnostic ne divulgue aucun secret', () => {
  it.each(Object.entries(SECRETS))('« %s » n’apparaît nulle part dans la sortie', (nom, valeur) => {
    const sortie = JSON.stringify(diagnostiquer({ ...CONTEXTE, env: COMPLET }));

    expect(
      sortie.includes(valeur),
      `Le secret « ${nom} » est recopié dans le diagnostic. Cette sortie est faite ` +
        'pour être collée dans un message : dites « définie » ou « absente », ' +
        'jamais la valeur. Pour une URL, l’hôte seul suffit à repérer une faute de frappe.',
    ).toBe(false);
  });

  it('donne quand même l’hôte, qui n’est pas un secret et sert au diagnostic', () => {
    const sortie = JSON.stringify(diagnostiquer({ ...CONTEXTE, env: COMPLET }));
    expect(sortie).toContain('smtp.hostinger.com');
    expect(sortie).toContain('mysql.hostinger.com');
  });
});

describe('une configuration complète est déclarée saine', () => {
  it('aucun point en défaut', () => {
    const points = diagnostiquer({ ...CONTEXTE, env: COMPLET });
    const defauts = points.filter((p) => p.etat !== 'ok').map((p) => `${p.sujet} — ${p.constat}`);

    expect(defauts).toStrictEqual([]);
    expect(verdictGlobal(points)).toBe('ok');
  });

  it('les comptes sont annoncés ouverts', () => {
    const comptes = diagnostiquer({ ...CONTEXTE, env: COMPLET }).find((p) => p.sujet === 'Comptes');
    expect(comptes?.etat).toBe('ok');
  });
});

describe('chaque défaut nomme sa cause ET son remède', () => {
  it('un point en défaut sans remède serait un constat inutile', () => {
    const points = diagnostiquer({ ...CONTEXTE, env: {} });

    for (const point of points.filter((p) => p.etat !== 'ok')) {
      expect(point.remede, `« ${point.sujet} » signale un défaut sans dire quoi faire`).not.toBeNull();
      expect(point.remede!.length, point.sujet).toBeGreaterThan(20);
    }
  });
});

describe('la question qui revient : pourquoi les marées restent simulées', () => {
  const marees = (env: Environnement) =>
    diagnostiquer({ ...CONTEXTE, env }).find((p) => p.sujet === 'Marées')!;

  it('sans clé : le dit, et rappelle qu’il faut RECONSTRUIRE', () => {
    const p = marees({});
    expect(p.etat).toBe('absent');
    expect(p.remede).toContain('RECONSTRUIS');
  });

  it('clé posée sans bornage : nomme le quota, et dit que la clé n’y est pour rien', () => {
    /*
      C'est le cas qui coûte le plus de temps : la clé est bonne, le
      déploiement a réussi, et les marées restent simulées. Sans ce message on
      soupçonne la clé et on la régénère.
    */
    const p = marees({ STORMGLASS_API_KEY: SECRETS.cleStormglass });
    expect(p.etat).toBe('attention');
    expect(p.constat).toContain('TIDE_REAL_SPOTS');
    expect(p.constat).toContain('43 appels');
    expect(p.remede).toContain('TIDE_REAL_SPOTS=');
  });

  it('clé et bornage : annonce les spots réellement servis en réel', () => {
    const p = marees({ STORMGLASS_API_KEY: SECRETS.cleStormglass, TIDE_REAL_SPOTS: 'pen-hat,etretat' });
    expect(p.etat).toBe('ok');
    expect(p.constat).toContain('pen-hat, etretat');
  });

  it('TIDE_PROVIDER=mock l’emporte sur la clé, et le dit', () => {
    const p = marees({ STORMGLASS_API_KEY: SECRETS.cleStormglass, TIDE_PROVIDER: 'mock' });
    expect(p.etat).toBe('attention');
    expect(p.constat).toContain('force les marées simulées');
  });
});

describe('les pannes silencieuses connues sont toutes couvertes', () => {
  const sujets = (env: Environnement) =>
    diagnostiquer({ ...CONTEXTE, env })
      .filter((p) => p.etat !== 'ok')
      .map((p) => p.sujet);

  it('AUTH_URL manquante en production', () => {
    expect(sujets({ ...COMPLET, AUTH_URL: undefined })).toContain('Hôte de confiance (Auth.js)');
  });

  it('mot de passe de base contenant un « / »', () => {
    const casse = { ...COMPLET, DATABASE_URL: 'mysql://u:mot/de/passe@localhost:3306/base' };
    expect(sujets(casse)).toContain('Base de données');
  });

  it('photos écrites dans le répertoire de l’application', () => {
    const points = diagnostiquer({ ...CONTEXTE, env: COMPLET, uploadsDir: '/app/var/photos' });
    expect(points.find((p) => p.sujet === 'Photos de prises')?.etat).toBe('attention');
  });

  it('NEXT_PUBLIC_SITE_URL absente — et le message insiste sur la reconstruction', () => {
    const p = diagnostiquer({ ...CONTEXTE, env: { ...COMPLET, NEXT_PUBLIC_SITE_URL: undefined } })
      .find((x) => x.sujet === 'Adresse publique du site');
    expect(p?.etat).toBe('attention');
    expect(p?.remede).toContain('RECONSTRUIS');
  });
});

describe('la forme de l’URL d’envoi', () => {
  const sujets = (env: Environnement) =>
    diagnostiquer({ ...CONTEXTE, env }).filter((p) => p.etat !== 'ok').map((p) => p.sujet);

  it.each([
    ['un « / » dans le mot de passe', 'smtp://contact%40lunamarea.fr:Mot/Passe@smtp.hostinger.com:587'],
    ['un « ? »', 'smtp://contact%40lunamarea.fr:Mot?Passe@smtp.hostinger.com:587'],
    ['un « # »', 'smtp://contact%40lunamarea.fr:Mot#Passe@smtp.hostinger.com:587'],
  ])('signale %s', (_cas, url) => {
    /*
      Ces caractères ne rendent pas EMAIL_SERVER absente : ils la rendent
      TROMPEUSE. La connexion part vers un autre hôte, avec un mot de passe
      vide. Sans ce point, le diagnostic dirait « les courriels partent par
      … » en nommant le mauvais serveur.
    */
    expect(sujets({ ...COMPLET, EMAIL_SERVER: url })).toContain('Forme de l’URL d’envoi');
  });

  it('ne signale RIEN pour un « @ » d’identifiant non encodé', () => {
    /*
      Mesuré : `new URL()` lit `contact@lunamarea.fr:mdp@smtp.hôte` et
      `contact%40lunamarea.fr:mdp@smtp.hôte` exactement pareil. Signaler cette
      forme enverrait corriger un non-problème pendant que la vraie cause
      reste entière — c'est l'erreur que ce projet a déjà commise une fois.
      */
    const sansEncodage = 'smtp://contact@lunamarea.fr:MotDePasse@smtp.hostinger.com:587';

    expect(sujets({ ...COMPLET, EMAIL_SERVER: sansEncodage })).not.toContain('Forme de l’URL d’envoi');

    const analysee = new URL(sansEncodage);
    expect(analysee.host).toBe('smtp.hostinger.com:587');
    expect(decodeURIComponent(analysee.username)).toBe('contact@lunamarea.fr');
    expect(decodeURIComponent(analysee.password)).toBe('MotDePasse');
  });
});

describe('l’état des comptes suit la règle réelle, pas l’ancienne', () => {
  const compte = (env: Environnement) =>
    diagnostiquer({ ...CONTEXTE, env }).find((p) => p.sujet === 'Comptes')!;

  it('une base SEULE ouvre les comptes', () => {
    /*
      Ce point affirmait « il faut la base ET le courriel ». C'était vrai du
      temps où le lien par courriel était le seul chemin. Depuis
      l'inscription par mot de passe, il annonçait des comptes FERMÉS sur un
      déploiement où l'on venait d'en créer un — observé en production.
    */
    const sansCourriel = { ...COMPLET, EMAIL_SERVER: undefined, EMAIL_FROM: undefined };
    const p = compte(sansCourriel);

    expect(p.etat).not.toBe('absent');
    expect(p.constat).toContain('ouverts');
  });

  it('mais signale que le mot de passe oublié est alors sans recours', () => {
    const p = compte({ ...COMPLET, EMAIL_SERVER: undefined, EMAIL_FROM: undefined });

    expect(p.etat).toBe('attention');
    expect(p.constat).toContain('OUBLIÉ');
    expect(p.remede).toContain('EMAIL_SERVER');
  });

  it('sans base, les comptes sont bien fermés', () => {
    expect(compte({ ...COMPLET, DATABASE_URL: undefined }).etat).toBe('absent');
  });

  it('base et courriel : rien à signaler', () => {
    expect(compte(COMPLET).etat).toBe('ok');
  });
});


describe('l’empreinte de construction dans le diagnostic', () => {
  const version = (buildStamp: string) =>
    diagnostiquer({ ...CONTEXTE, buildStamp, env: COMPLET }).find((p) => p.sujet === 'Version en ligne')!;

  it('est le PREMIER point : c’est la question à trancher avant les autres', () => {
    const points = diagnostiquer({ ...CONTEXTE, env: COMPLET });
    expect(points[0]?.sujet).toBe('Version en ligne');
  });

  it('affiche l’horodatage reçu', () => {
    expect(version('2026-09-11T08:00:00Z').constat).toContain('2026-09-11T08:00:00Z');
  });

  it('dit son absence au lieu de la maquiller', () => {
    /*
      Compilé par `next build` directement, l'horodatage manque. Afficher un
      instant inventé annulerait tout l'intérêt du dispositif : on croirait
      savoir quelle version est en ligne.
    */
    const p = version('inconnue');
    expect(p.etat).toBe('attention');
    expect(p.remede).toContain('npm run build');
  });
});


describe('les textes d’exemple pris pour des valeurs', () => {
  const sujets = (env: Environnement) =>
    diagnostiquer({ ...CONTEXTE, env }).filter((p) => p.etat !== 'ok').map((p) => p.sujet);

  const GABARIT = 'Textes d’exemple pris pour des valeurs';

  it('attrape le cas réel : « UTILISATEUR » et « MOTDEPASSE » dans DATABASE_URL', () => {
    /*
      Le cas observé en production. L'identifiant MySQL était resté le mot
      d'exemple de la documentation, et MySQL répondait « Access denied for
      user 'UTILISATEUR' » à chaque page. En aval, migrations, comptes et
      compteurs échouaient — chacun se plaignant d'autre chose.
    */
    const colle = {
      ...COMPLET,
      DATABASE_URL: 'mysql://UTILISATEUR:MOTDEPASSE@localhost:3306/u969082232_moonfish',
    };

    const point = diagnostiquer({ ...CONTEXTE, env: colle }).find((p) => p.sujet === GABARIT);

    expect(point?.etat).toBe('absent');
    expect(point?.constat).toContain('l’identifiant');
    expect(point?.constat).toContain('le mot de passe');
  });

  it('attrape aussi un secret laissé au gabarit', () => {
    expect(sujets({ ...COMPLET, CRON_SECRET: 'COLLEZ_ICI_VOTRE_CRON_SECRET' })).toContain(GABARIT);
    expect(sujets({ ...COMPLET, AUTH_SECRET: 'VOTRE_SECRET' })).toContain(GABARIT);
  });

  it('ne signale RIEN sur des valeurs réelles', () => {
    // Le contrôle doit rester muet sur une configuration correcte, sinon on
    // cesse de le lire — et c'est précisément ce qu'il fallait éviter.
    expect(sujets(COMPLET)).not.toContain(GABARIT);
  });

  it('est rendu AVANT les points qui ne feraient que répéter la panne', () => {
    const colle = {
      ...COMPLET,
      DATABASE_URL: 'mysql://UTILISATEUR:MOTDEPASSE@localhost:3306/base',
    };
    const points = diagnostiquer({ ...CONTEXTE, env: colle });

    const rangGabarit = points.findIndex((p) => p.sujet === GABARIT);
    const rangBase = points.findIndex((p) => p.sujet === 'Base de données');

    expect(rangGabarit).toBeGreaterThanOrEqual(0);
    expect(rangGabarit).toBeLessThan(rangBase);
  });
});


describe('TIDE_REAL_SPOTS qui ne désigne rien', () => {
  /*
    Vu en ligne : clé posée, fournisseur déclaré, et pas un seul spot en
    marée réelle — sans voyant de panne. La liste ne correspondait à aucun
    spot, et le site l'appliquait sans un mot.
  */
  it('est un défaut franc, qui nomme les entrées fautives', () => {
    const points = diagnostiquer({ ...CONTEXTE, env: { ...COMPLET, TIDE_REAL_SPOTS: 'Pen Hat, Étretat' } });
    const marees = points.find((p) => p.sujet === 'Marées');
    expect(marees?.etat).toBe('absent');
    expect(marees?.constat).toContain('« pen »');
    expect(marees?.constat).toContain('« étretat »');
    expect(marees?.remede).toContain('pen-hat');
  });

  it('signale les noms inconnus quand certains sont bons', () => {
    const points = diagnostiquer({ ...CONTEXTE, env: { ...COMPLET, TIDE_REAL_SPOTS: 'pen-hat,plage-inconnue' } });
    const marees = points.find((p) => p.sujet === 'Marées');
    expect(marees?.etat).toBe('attention');
    expect(marees?.constat).toContain('« plage-inconnue »');
  });

  it('accepte guillemets, points-virgules et majuscules sans broncher', () => {
    const points = diagnostiquer({ ...CONTEXTE, env: { ...COMPLET, TIDE_REAL_SPOTS: '"Pen-Hat; la-torche"' } });
    expect(points.find((p) => p.sujet === 'Marées')?.etat).toBe('ok');
  });
});
