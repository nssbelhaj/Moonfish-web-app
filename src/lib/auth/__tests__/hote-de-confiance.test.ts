import { afterEach, describe, expect, it, vi } from 'vitest';

/*
  ────────────────────────────────────────────────────────────────────────────
   Auth.js v5 refuse toute requête d'authentification si l'hôte n'est pas de
   confiance, et son défaut ne couvre PAS un hébergement mutualisé en
   production :

     trustHost ??= !!(AUTH_URL ?? AUTH_TRUST_HOST ?? VERCEL ?? CF_PAGES
                      ?? NODE_ENV !== 'production')

   Reproduit avant d'écrire ce test : sans AUTH_URL, la page /compte répond
   200, le formulaire s'affiche, la demande sort en 500 avec UntrustedHost, et
   aucun courriel ne part. La personne lit « réessayez plus tard » — pour une
   panne qui ne se corrigera jamais d'elle-même.

   Ces tests fixent les quatre échappatoires reconnues par la bibliothèque. En
   ajouter une cinquième dans le code sans l'ajouter ici, ou l'inverse, fait
   tomber la suite.

   ─── Pourquoi chaque cas RÉIMPORTE le module ─────────────────────────────

   `databaseEnabled()` lit la configuration UNE FOIS, au chargement du module.
   Poser `DATABASE_URL` après l'import ne change donc rien — ma première
   version de ce fichier échouait pour cette raison, et c'était le test qui
   avait tort : en production, les variables existent avant que le processus
   démarre. `vi.resetModules()` reproduit cet ordre.
  ────────────────────────────────────────────────────────────────────────────
*/

const SAUVEGARDE = { ...process.env };

afterEach(() => {
  // `process.env` est partagé par tout le fichier de test : on le restitue.
  for (const cle of Object.keys(process.env)) delete process.env[cle];
  Object.assign(process.env, SAUVEGARDE);
});

/** Charge `authHostWarning` APRÈS que l'environnement soit posé. */
async function avertissement(): Promise<string | null> {
  vi.resetModules();
  const { authHostWarning } = await import('../config');
  return authHostWarning();
}

/** Un déploiement où les comptes sont censés marcher : base ET courriel. */
function comptesOuvertsEnProduction(): void {
  process.env['NODE_ENV'] = 'production';
  process.env['DATABASE_URL'] = 'mysql://u:p@localhost:3306/base';
  process.env['EMAIL_SERVER'] = 'smtp://boite@exemple.fr:motdepasse@smtp.exemple.fr:587';
  process.env['EMAIL_FROM'] = 'contact@exemple.fr';

  for (const cle of ['AUTH_URL', 'AUTH_TRUST_HOST', 'VERCEL', 'CF_PAGES']) {
    delete process.env[cle];
  }
}

describe('l’avertissement d’hôte de confiance', () => {
  it('prévient quand AUTH_URL manque en production, comptes ouverts', async () => {
    comptesOuvertsEnProduction();

    const message = await avertissement();
    expect(message).not.toBeNull();
    // Le message doit nommer la cause ET donner la variable à définir : sans
    // cela il envoie chercher du côté du serveur de courriel.
    expect(message).toContain('AUTH_URL');
    expect(message).toContain('UntrustedHost');
  });

  it.each(['AUTH_URL', 'AUTH_TRUST_HOST', 'VERCEL', 'CF_PAGES'])(
    'se tait dès que %s est défini — les quatre échappatoires de la bibliothèque',
    async (cle) => {
      comptesOuvertsEnProduction();
      process.env[cle] = cle === 'AUTH_URL' ? 'https://lunamarea.fr' : '1';

      expect(await avertissement()).toBeNull();
    },
  );

  it('se tait hors production : le défaut de la bibliothèque suffit', async () => {
    comptesOuvertsEnProduction();
    process.env['NODE_ENV'] = 'development';

    expect(await avertissement()).toBeNull();
  });

  it('se tait quand les comptes ne sont pas ouverts : rien à casser', async () => {
    comptesOuvertsEnProduction();
    delete process.env['EMAIL_SERVER'];

    expect(await avertissement()).toBeNull();
  });
});
