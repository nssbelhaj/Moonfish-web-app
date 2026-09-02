import { describe, expect, it } from 'vitest';

import { lireConfigBase, type Environnement } from '../config';
// @ts-expect-error — jumeau en JavaScript pur, sans types : c'est justement ce
// que ce fichier compare. Lui écrire une déclaration ferait décrire la même
// règle une troisième fois.
import { lireConfigBase as lireConfigBaseJs } from '../../../../scripts/lib/config-base.mjs';

/*
  ────────────────────────────────────────────────────────────────────────────
   Deux implémentations, une seule règle.

   Le script de migration tourne hors de TypeScript : il lui faut sa propre
   lecture de la configuration. Deux implémentations d'une même règle
   divergent toujours, et ici la divergence serait invisible — le site dirait
   « comptes fermés » pendant que le déploiement dirait « base à jour ».

   Ces tests jouent donc CHAQUE cas contre les deux, et échouent au premier
   désaccord.
  ────────────────────────────────────────────────────────────────────────────
*/

type Cas = { readonly nom: string; readonly env: Environnement };

const CAS: readonly Cas[] = [
  { nom: 'rien du tout', env: {} },
  { nom: 'URL complète', env: { DATABASE_URL: 'mysql://u:p@h:3307/base' } },
  { nom: 'sans port', env: { DATABASE_URL: 'mysql://u:p@h/base' } },
  { nom: 'port absurde', env: { DATABASE_URL: 'mysql://u:p@h:0/base' } },
  { nom: 'mot de passe vide', env: { DATABASE_URL: 'mysql://u@h:3306/base' } },
  { nom: 'arobase dans le mot de passe', env: { DATABASE_URL: 'mysql://u:GoT@100*@h:3306/base' } },
  { nom: 'slash dans le mot de passe', env: { DATABASE_URL: 'mysql://u:GoT/Zut@h:3306/base' } },
  { nom: 'point d’interrogation', env: { DATABASE_URL: 'mysql://u:GoT?Zut@h:3306/base' } },
  { nom: 'croisillon', env: { DATABASE_URL: 'mysql://u:GoT#Zut@h:3306/base' } },
  { nom: 'pourcent invalide', env: { DATABASE_URL: 'mysql://u:GoT%1@h:3306/base' } },
  { nom: 'pourcent encodé', env: { DATABASE_URL: 'mysql://u:GoT%25100@h:3306/base' } },
  { nom: 'sans base', env: { DATABASE_URL: 'mysql://u:p@h:3306' } },
  { nom: 'pas une URL', env: { DATABASE_URL: 'localhost' } },
  { nom: 'espaces autour', env: { DATABASE_URL: '  mysql://u:p@h:3306/base  ' } },
  { nom: 'variables séparées', env: { MYSQL_HOST: 'h', MYSQL_USER: 'u', MYSQL_PASSWORD: 'p', MYSQL_DATABASE: 'b' } },
  { nom: 'séparées, hôte seul', env: { MYSQL_HOST: 'h' } },
  { nom: 'séparées, mot de passe absent', env: { MYSQL_HOST: 'h', MYSQL_USER: 'u', MYSQL_DATABASE: 'b' } },
  { nom: 'URL prioritaire sur les séparées', env: { DATABASE_URL: 'mysql://a:b@c:3306/d', MYSQL_HOST: 'h' } },
];

describe('les deux lectures de configuration ne peuvent pas diverger', () => {
  it.each(CAS)('$nom', ({ env }) => {
    expect(lireConfigBase(env)).toStrictEqual(lireConfigBaseJs(env));
  });
});

describe('une variable renseignée mais illisible ne passe pas pour une absence', () => {
  /*
    Le défaut d'origine. `DATABASE_URL` posée mais inexploitable rendait le même
    `null` qu'une absence : le déploiement affichait « aucune base configurée :
    rien à faire », en vert et exit 0, et les comptes restaient fermés sans que
    rien ne désigne la cause.
  */
  it.each([
    ['un slash', 'mysql://u:GoT/Zut@h:3306/base'],
    ['un point d’interrogation', 'mysql://u:GoT?Zut@h:3306/base'],
    ['un croisillon', 'mysql://u:GoT#Zut@h:3306/base'],
    ['un pourcent invalide', 'mysql://u:GoT%1@h:3306/base'],
    ['aucune base', 'mysql://u:p@h:3306'],
  ])('%s est signalé, pas ignoré', (_nom, url) => {
    const verdict = lireConfigBase({ DATABASE_URL: url });

    expect(verdict.kind).toBe('illisible');
    if (verdict.kind !== 'illisible') return;

    // Le message doit nommer la cause ET la correction : « URL invalide » seul
    // renverrait chercher au hasard.
    expect(verdict.raison.length).toBeGreaterThan(20);
    expect(verdict.remede.length).toBeGreaterThan(20);
  });

  it('une configuration partielle par variables séparées est signalée', () => {
    const verdict = lireConfigBase({ MYSQL_HOST: 'h', MYSQL_USER: 'u' });

    expect(verdict.kind).toBe('illisible');
    if (verdict.kind !== 'illisible') return;
    expect(verdict.raison).toContain('MYSQL_DATABASE');
  });

  it('l’absence totale reste une absence, sans bruit', () => {
    expect(lireConfigBase({})).toStrictEqual({ kind: 'absente' });
  });
});

describe('le « @ » d’un mot de passe n’a rien à encoder', () => {
  /*
    Contre-vérité tenace, et je l'ai moi-même écrite dans la documentation :
    l'analyseur d'URL retient le DERNIER « @ » comme séparateur. C'est vrai
    pour SMTP, où l'identifiant est une adresse e-mail suivie d'un autre « @ »,
    ce n'est pas vrai ici.
  */
  it('accepte un mot de passe qui en contient un', () => {
    const verdict = lireConfigBase({
      DATABASE_URL: 'mysql://u969082232_nssbelhaj:MOT@DE*PASSE@localhost:3306/u969082232_moonfish',
    });

    expect(verdict).toStrictEqual({
      kind: 'ok',
      config: {
        host: 'localhost',
        port: 3306,
        user: 'u969082232_nssbelhaj',
        password: 'MOT@DE*PASSE',
        database: 'u969082232_moonfish',
      },
    });
  });
});
