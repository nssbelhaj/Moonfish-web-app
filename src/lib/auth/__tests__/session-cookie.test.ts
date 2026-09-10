import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { nomDuCookie } from '../session-cookie';

/*
  ────────────────────────────────────────────────────────────────────────────
   Ce module écrit un cookie qu'Auth.js relira. Il dépend donc d'un détail
   INTERNE de la bibliothèque : le nom de ce cookie, défini dans
   `@auth/core/lib/utils/cookie.js`, qui n'est pas une interface publique.

   Un couplage à un détail interne n'est pas interdit — il est parfois la
   seule voie. Ce qui est interdit, c'est qu'il casse en silence. Une montée
   de version qui déplacerait le cookie déconnecterait tout le monde sans une
   ligne d'erreur : la connexion « réussirait », poserait un cookie que
   personne ne lit, et la personne se retrouverait déconnectée à la page
   suivante.

   Ce test relit la source d'Auth.js à chaque exécution.
  ────────────────────────────────────────────────────────────────────────────
*/

const SOURCE_AUTH = 'node_modules/@auth/core/lib/utils/cookie.js';

describe('le nom du cookie de session', () => {
  it('est toujours celui qu’Auth.js déclare', () => {
    const source = readFileSync(SOURCE_AUTH, 'utf8');

    expect(
      source,
      `Auth.js ne déclare plus « authjs.session-token » dans ${SOURCE_AUTH}.\n\n` +
        'Le cookie a changé de nom : `src/lib/auth/session-cookie.ts` écrit désormais ' +
        'un cookie que la bibliothèque ne relira pas. La connexion paraîtra réussir ' +
        'et la session sera perdue à la page suivante. Alignez la constante NOM_COOKIE.',
    ).toContain('authjs.session-token');
  });

  it('Auth.js applique bien le préfixe « __Secure- » en HTTPS', () => {
    const source = readFileSync(SOURCE_AUTH, 'utf8');
    expect(source).toContain('__Secure-');
    expect(source).toContain('${cookiePrefix}authjs.session-token');
  });
});

describe('le préfixe suit la même règle qu’Auth.js', () => {
  it.each([
    ['https://lunamarea.fr', '__Secure-authjs.session-token'],
    ['http://localhost:3000', 'authjs.session-token'],
    ['', 'authjs.session-token'],
  ])('AUTH_URL=%s → %s', (url, attendu) => {
    expect(nomDuCookie({ AUTH_URL: url })).toBe(attendu);
  });

  it('retombe sur NEXT_PUBLIC_SITE_URL quand AUTH_URL manque', () => {
    /*
      Cas réel : AUTH_URL oubliée en production. Le cookie doit rester
      sécurisé — sinon un navigateur en HTTPS refuserait un cookie non
      « __Secure- » posé sur une page sécurisée… ou pire, l'accepterait en
      clair.
    */
    expect(nomDuCookie({ NEXT_PUBLIC_SITE_URL: 'https://lunamarea.fr' })).toBe(
      '__Secure-authjs.session-token',
    );
  });
});
