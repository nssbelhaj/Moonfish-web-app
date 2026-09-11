import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

import { nomDuCookiePour } from '../session-cookie';

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

describe('le préfixe se décide sur la REQUÊTE, comme chez Auth.js', () => {
  /*
    LE DÉFAUT OBSERVÉ EN PRODUCTION.

    Auth.js calcule `useSecureCookies ?? url.protocol === 'https:'`, où `url`
    est celle de la REQUÊTE. La première version d'ici lisait trois variables
    d'environnement. Sur un site servi en HTTPS dont aucune n'était posée,
    l'inscription écrivait `authjs.session-token` et Auth.js cherchait
    `__Secure-authjs.session-token` : l'inscription « réussissait », et la page
    suivante affichait un visiteur déconnecté. Sans le moindre message.
  */
  it('site en HTTPS SANS aucune variable : le cookie est quand même préfixé', () => {
    expect(nomDuCookiePour({ protocoleTransmis: 'https' })).toBe('__Secure-authjs.session-token');
  });

  it('le protocole de la requête l’emporte sur les variables', () => {
    // Un AUTH_URL en http sur un site réellement servi en https ne doit pas
    // faire écrire un cookie que la bibliothèque ne relira pas.
    expect(
      nomDuCookiePour({ protocoleTransmis: 'https', authUrl: 'http://exemple.test' }),
    ).toBe('__Secure-authjs.session-token');
  });

  it('développement local en clair : pas de préfixe', () => {
    expect(nomDuCookiePour({ protocoleTransmis: 'http', authUrl: 'http://localhost:3000' })).toBe(
      'authjs.session-token',
    );
  });

  it('ne garde que le PREMIER protocole d’une chaîne de proxys', () => {
    // `x-forwarded-proto` s'accumule : « https, http » vient d'un second
    // proxy interne. C'est le premier qui dit ce que le navigateur a vu.
    expect(nomDuCookiePour({ protocoleTransmis: 'https, http' })).toBe(
      '__Secure-authjs.session-token',
    );
  });

  it.each([
    ['AUTH_URL', { authUrl: 'https://lunamarea.fr' }],
    ['NEXT_PUBLIC_SITE_URL', { siteUrl: 'https://lunamarea.fr' }],
  ])('sans en-tête de proxy, %s sert de repli', (_cas, conditions) => {
    expect(nomDuCookiePour(conditions)).toBe('__Secure-authjs.session-token');
  });

  it('sans rien du tout : pas de préfixe', () => {
    expect(nomDuCookiePour({})).toBe('authjs.session-token');
  });
});

describe('notre règle et celle d’Auth.js donnent le MÊME nom', () => {
  /*
    Le test qui compte. Plutôt que de décrire la règle d'Auth.js de mémoire,
    on charge SA fonction et on compare les deux sorties. Un changement de
    préfixe dans la bibliothèque fait échouer ici, pas en production.
  */
  it.each([
    ['https', true],
    ['http', false],
  ])('protocole %s', async (protocole, securiseAttendu) => {
    /*
      Chargé par chemin de fichier, pas par nom de paquet : `@auth/core`
      n'expose pas ce sous-chemin. C'est assumé — tout l'intérêt est justement
      d'atteindre l'interne dont on dépend, pour que son changement se voie
      ici et non en production.
    */
    const chemin = pathToFileURL(
      path.resolve('node_modules/@auth/core/lib/utils/cookie.js'),
    ).href;

    const { defaultCookies } = (await import(/* @vite-ignore */ chemin)) as {
      defaultCookies: (s: boolean) => { sessionToken: { name: string } };
    };

    const chezAuthJs = defaultCookies(securiseAttendu).sessionToken.name;
    const chezNous = nomDuCookiePour({ protocoleTransmis: protocole });

    expect(chezNous).toBe(chezAuthJs);
  });
});
