import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { BUDGETS, RETENTION_MS, delaiLisible } from '@/lib/limites';

/*
  ────────────────────────────────────────────────────────────────────────────
   Ce fichier protège une chose que les tests d'intégration ne voient pas :
   qu'une action nouvellement écrite N'OUBLIE PAS de consommer un budget.

   C'est exactement ce qui s'était produit. Le limiteur existait, il était même
   documenté — et il ne couvrait qu'un seul point d'entrée, la liste d'attente.
   Le formulaire de connexion, écrit plus tard, faisait partir un courriel vers
   une adresse fournie par l'appelant, sans authentification et sans compteur.
   Personne ne l'avait remarqué parce que rien ne le vérifiait.

   La règle est donc structurelle : toute action qui rend un `ActionState` doit
   soit consommer un budget, soit figurer ci-dessous avec sa raison. On peut
   décider qu'une action n'en a pas besoin ; on ne peut plus l'oublier.
  ────────────────────────────────────────────────────────────────────────────
*/

const SOURCE = readFileSync('src/lib/auth/actions.ts', 'utf8');

/** Actions exemptées, chacune pour une raison qui tient. */
const EXEMPTES: Record<string, string> = {
  /*
    La clé primaire composée (personne, spot) borne la table à une ligne par
    spot et par personne. Marteler le bouton ne fait grossir aucune table.
  */
  toggleFavorite: 'bornée par la clé primaire composée',

  /*
    Une suppression de compte n'est possible qu'une fois, et la seconde
    tentative ne trouve plus de session. Le limiter reviendrait à retarder
    quelqu'un qui veut partir — l'inverse de ce que promet la page « Vos
    données ».
  */
  deleteAccount: 'ne peut aboutir qu’une fois, et retarder un départ serait malvenu',
};

/** Corps d'une fonction exportée, du `export` au `export` suivant. */
function corps(nom: string): string {
  const debut = SOURCE.indexOf(`export async function ${nom}(`);
  if (debut === -1) throw new Error(`action « ${nom} » introuvable`);

  const suivant = SOURCE.indexOf('\nexport async function ', debut + 1);
  return SOURCE.slice(debut, suivant === -1 ? undefined : suivant);
}

/** Toutes les actions rendant un `ActionState`. */
function actionsAvecEtat(): string[] {
  const noms: string[] = [];

  for (const match of SOURCE.matchAll(/export async function (\w+)\(([\s\S]{0,200}?)\)\s*:\s*Promise<(\w+)>/g)) {
    if (match[3] === 'ActionState') noms.push(match[1] ?? '');
  }

  return noms;
}

describe('les budgets d’appel', () => {
  it('chaque budget a une file distincte : deux noms identiques mélangeraient les compteurs', () => {
    const files = Object.values(BUDGETS).map((budget) => budget.bucket);
    expect(new Set(files).size).toBe(files.length);
  });

  it('la rétention couvre la plus longue fenêtre, sinon le ménage effacerait des compteurs vivants', () => {
    for (const budget of Object.values(BUDGETS)) {
      expect(RETENTION_MS).toBeGreaterThanOrEqual(budget.windowMs);
    }
  });

  it('le plafond global dépasse les budgets individuels : sinon il ne servirait qu’à bloquer le premier venu', () => {
    expect(BUDGETS.connexionGlobal.limit).toBeGreaterThan(BUDGETS.connexionIp.limit);
    expect(BUDGETS.connexionIp.limit).toBeGreaterThan(BUDGETS.connexionAdresse.limit);
  });
});

describe('aucune action ne peut oublier son budget', () => {
  it.each(actionsAvecEtat())('%s', (nom) => {
    const raison = EXEMPTES[nom];
    const texte = corps(nom);
    const consomme = /budgetEcriture\(|consommer\(/.test(texte);

    if (raison !== undefined) {
      expect(
        consomme,
        `« ${nom} » est exemptée (${raison}) mais consomme un budget. ` +
          'Retirez-la des exemptions, ou retirez le budget.',
      ).toBe(false);
      return;
    }

    expect(
      consomme,
      `« ${nom} » ne consomme aucun budget d’appel.\n\n` +
        'Ajoutez `const trop = await budgetEcriture(user.id); if (trop) return trop;` ' +
        'après la vérification de session, ou inscrivez l’action dans EXEMPTES ' +
        'de ce fichier avec la raison. Les deux sont acceptables ; l’oubli ne l’est pas.',
    ).toBe(true);
  });

  it('la demande de lien de connexion consomme les TROIS budgets', () => {
    /*
      Les trois sont nécessaires et couvrent des abus différents : noyer une
      boîte précise, arroser mille adresses, épuiser le quota d'envoi du
      serveur. En retirer un rouvre un des trois.
    */
    const texte = corps('requestSignInLink');

    for (const budget of ['connexionAdresse', 'connexionIp', 'connexionGlobal'] as const) {
      expect(texte, `budget « ${budget} » absent de requestSignInLink`).toContain(
        `BUDGETS.${budget}`,
      );
    }
  });

  it('le budget par adresse est consommé avant le budget global', () => {
    /*
      L'ordre importe : consommer le compteur de tout le site avant d'avoir
      écarté l'abus local laisserait un seul script épuiser, pour tout le
      monde, un plafond qu'il n'aurait jamais dû atteindre.
    */
    const texte = corps('requestSignInLink');
    expect(texte.indexOf('BUDGETS.connexionAdresse')).toBeLessThan(
      texte.indexOf('BUDGETS.connexionGlobal'),
    );
  });
});

describe('le délai annoncé', () => {
  const now = Date.UTC(2026, 8, 9, 12, 0, 0);

  it('n’annonce jamais « 0 minute », même à une seconde du déblocage', () => {
    expect(delaiLisible(now + 900, now)).toBe('1 minute');
    expect(delaiLisible(now - 5_000, now)).toBe('1 minute');
  });

  it('arrondit vers le haut : mieux vaut revenir trop tard que trop tôt', () => {
    expect(delaiLisible(now + 61_000, now)).toBe('2 minutes');
  });

  it('passe aux heures au-delà de soixante minutes', () => {
    expect(delaiLisible(now + 3_600_000, now)).toBe('1 heure');
    expect(delaiLisible(now + 2 * 3_600_000, now)).toBe('2 heures');
  });
});

describe('l’action de connexion rembourse quand l’envoi échoue', () => {
  /*
    Défaut observé en production, sur la vraie machine.

    Les budgets se prennent AVANT `signIn`. Quand l'envoi échouait, ils
    restaient débités : au quatrième essai le formulaire répondait « un lien a
    déjà été demandé, vérifiez vos indésirables » alors qu'aucun des trois
    envois n'avait abouti. Le site envoyait chercher un courriel jamais parti,
    et masquait la panne réelle pendant quinze minutes.

    Ce test est structurel comme les autres de ce fichier : il lit la source.
    Exercer le vrai chemin demanderait un serveur d'envoi en panne, une base,
    et une session — trois dépendances pour vérifier trois lignes.
  */
  const texte = SOURCE.slice(
    SOURCE.indexOf('export async function requestSignInLink('),
    SOURCE.indexOf('\nexport async function signOut('),
  );

  it('le bloc `catch` de l’envoi rembourse les TROIS budgets', () => {
    const attrape = texte.slice(texte.indexOf('} catch (error) {'));

    for (const budget of ['connexionAdresse', 'connexionIp', 'connexionGlobal'] as const) {
      expect(attrape, `« ${budget} » n’est pas remboursé après un échec d’envoi`).toContain(
        `rembourser(BUDGETS.${budget}`,
      );
    }
  });

  it('le message de refus ne promet PAS qu’un lien est parti', () => {
    /*
      « Vérifiez vos indésirables » est une affirmation : elle dit qu'un
      courriel existe. Quand l'envoi a échoué, elle est fausse — et c'est
      précisément le moment où elle s'affiche.
    */
    expect(texte).not.toContain('Un lien a déjà été demandé');
    expect(texte).toContain('Trop de demandes pour cette adresse');
  });
});

describe('un compteur en panne ne se dit pas comme un dépassement', () => {
  /*
    Les deux refusent — un compteur injoignable ne doit pas rouvrir le
    robinet. Mais « réessayez dans 15 minutes » envoie attendre pour rien
    quand la cause est une table absente : au retour, même refus, même délai,
    et rien ne mentionne jamais les migrations.

    Ce cas est arrivé en production sans qu'on puisse le distinguer d'une
    limite atteinte, parce que les deux affichaient la même phrase.
  */
  const texte = SOURCE.slice(
    SOURCE.indexOf('export async function requestSignInLink('),
    SOURCE.indexOf('\nexport async function signOut('),
  );

  it('les trois budgets de connexion distinguent la panne', () => {
    for (const budget of ['parAdresse', 'parIp', 'global']) {
      expect(texte, `« ${budget} » ne distingue pas une panne de compteur`).toContain(
        `if (${budget}.panne) return COMPTEUR_EN_PANNE;`,
      );
    }
  });

  it('le budget d’écriture aussi', () => {
    expect(SOURCE).toContain('if (decision.panne) return COMPTEUR_EN_PANNE;');
  });

  it('le message nomme les migrations, pas un délai d’attente', () => {
    const message = SOURCE.slice(SOURCE.indexOf('const COMPTEUR_EN_PANNE'), SOURCE.indexOf('const NOT_SIGNED_IN'));
    expect(message).toContain('migrations');
    expect(message).not.toMatch(/réessayez dans/i);
  });
});
