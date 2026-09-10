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

const CONTEXTE = { spotCount: 42, uploadsDir: '/var/photos', appDir: '/app' };

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
  DATABASE_URL: `mysql://utilisateur:${SECRETS.motDePasseBase}@mysql.hostinger.com:3306/u969082232_moonfish`,
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
