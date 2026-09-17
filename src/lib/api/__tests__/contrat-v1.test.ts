import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  Ce que toute route de l'API v1 doit respecter, sans exception
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Une API publique se dégrade autrement qu'une page : personne ne la REGARDE.
 * Une route qui oublie son enveloppe, sa limite d'appels ou sa décision de
 * cache ne montre rien de bizarre à l'écran — elle marche, et le défaut
 * n'apparaît qu'en facture, en fuite, ou en caractères accentués cassés sur
 * un téléphone qu'on n'a pas sous la main.
 *
 * Ces tests lisent donc les fichiers de routes et refusent ce qu'une relecture
 * ne verrait pas.
 */

const ROOT = process.cwd();
const V1 = path.join(ROOT, 'src/app/api/v1');
const API = path.join(ROOT, 'src/app/api');

function routes(dir: string): string[] {
  return readdirSync(dir).flatMap((entree) => {
    const complet = path.join(dir, entree);
    if (statSync(complet).isDirectory()) return routes(complet);
    return entree === 'route.ts' ? [complet] : [];
  });
}

const FICHIERS = routes(V1);
const nom = (fichier: string) => path.relative(ROOT, fichier);
const lire = (fichier: string) => readFileSync(fichier, 'utf8');

/**
 * Le code seul, commentaires retirés.
 *
 * ═══ CE QUI A RENDU CE HELPER NÉCESSAIRE ═══
 *
 * Le contrôle « generateStaticParams est déclaré » a d'abord été écrit comme
 * une simple recherche du mot dans le fichier. Mis à l'épreuve — on retire la
 * fonction, le test doit tomber —, il est resté VERT : l'en-tête de la route
 * explique longuement pourquoi `generateStaticParams` est là, et le mot y
 * figurait donc encore.
 *
 * Un test qui se satisfait de sa propre documentation ne vérifie rien. Pire :
 * il vérifie d'autant moins que la décision est bien commentée, c'est-à-dire
 * exactement là où le projet met le plus de soin.
 *
 * Tous les contrôles qui exigent la PRÉSENCE de quelque chose lisent donc le
 * code nu. Ceux qui exigent son ABSENCE peuvent garder les commentaires : s'y
 * tromper donne un faux positif, qui se voit et se corrige, jamais un faux
 * feu vert.
 */
function code(fichier: string): string {
  return lire(fichier)
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ');
}

/** Les routes qui écrivent, par opposition à celles qui lisent. */
const ECRITURE = /export async function (POST|PUT|PATCH|DELETE)\b/;

describe('l’API v1 existe et couvre ce qui a été annoncé', () => {
  it('publie toutes les routes du cahier des charges', () => {
    const attendues = [
      'spots/route.ts',
      'spots/[slug]/prevision/route.ts',
      'spots/[slug]/contributions/route.ts',
      'auth/connexion/route.ts',
      'auth/inscription/route.ts',
      'auth/session/route.ts',
      'compte/route.ts',
      'compte/prises/route.ts',
      'compte/avis/route.ts',
      'compte/favoris/[slug]/route.ts',
      'compte/sorties/route.ts',
      'compte/appareils/route.ts',
    ];

    const presentes = FICHIERS.map((fichier) => path.relative(V1, fichier));
    for (const attendue of attendues) {
      expect(presentes, `route manquante : ${attendue}`).toContain(attendue);
    }
  });
});

describe('chaque route passe par l’enveloppe commune', () => {
  it('n’en fabrique aucune à la main', () => {
    const fautives: string[] = [];

    for (const fichier of FICHIERS) {
      const source = lire(fichier);
      /*
        `NextResponse.json()` et `new Response()` posent « application/json »
        SANS jeu de caractères, ou pas de type du tout. Les messages sont en
        français : sans `charset=utf-8`, un client qui suppose du latin-1
        affiche du charabia. Passer par `succes`/`refus` rend l'oubli
        impossible plutôt qu'improbable.
      */
      if (/NextResponse\s*\.\s*json|new\s+Response\s*\(/.test(source)) fautives.push(nom(fichier));
    }

    expect(
      fautives,
      `réponse fabriquée hors de l’enveloppe (charset non garanti) :\n${fautives.join('\n')}`,
    ).toStrictEqual([]);
  });

  it('importe l’enveloppe partout', () => {
    for (const fichier of FICHIERS) {
      expect(code(fichier), `${nom(fichier)} n’importe pas @/lib/api/reponse`).toContain(
        "from '@/lib/api/reponse'",
      );
    }
  });
});

describe('chaque route déclare sa posture de cache', () => {
  it('ne laisse aucune route au comportement par défaut', () => {
    const muettes = FICHIERS.filter(
      (fichier) => !/export const (dynamic|revalidate)\s*=/.test(code(fichier)),
    ).map(nom);

    /*
      Le défaut de Next a déjà changé entre deux versions majeures. Une route
      de prévision devenue dynamique sans qu'on le veuille sortirait du cache
      de `fetch` des fournisseurs : l'offre gratuite de Stormglass est de DIX
      appels par jour, elle serait épuisée avant le petit-déjeuner. Écrire la
      décision, c'est refuser de la subir.
    */
    expect(muettes, `route sans décision de cache écrite :\n${muettes.join('\n')}`).toStrictEqual([]);
  });

  it('garde les deux routes coûteuses en cache', () => {
    for (const route of ['spots/route.ts', 'spots/[slug]/prevision/route.ts']) {
      expect(code(path.join(V1, route)), `${route} devrait être mise en cache`).toMatch(
        /export const revalidate\s*=/,
      );
    }
  });

  it('accompagne tout segment dynamique caché de ses paramètres statiques', () => {
    /*
      ═══ UN DÉFAUT QUE SEUL LE BUILD POUVAIT MONTRER ═══

      `export const revalidate = 3600` ne suffit pas sur un segment `[slug]` :
      sans `generateStaticParams`, Next range la route en « ƒ », rendue à
      chaque appel. Le fichier se relisait pourtant comme une route cachée —
      la constante était là, bien visible, et mensongère.

      Rien ne l'aurait signalé à l'usage : les réponses restent justes. Le prix
      se paie sur le quota du fournisseur de marées, dix appels par jour,
      épuisés par une poignée d'ouvertures de l'application — puis quarante-
      deux spots retombés en marée simulée jusqu'au lendemain.

      Ce test relit donc les deux déclarations ENSEMBLE, parce que c'est leur
      couple qui met la route en cache, jamais l'une des deux seule.
    */
    const fautives: string[] = [];

    for (const fichier of FICHIERS) {
      const source = code(fichier);
      const segmentDynamique = fichier.includes('[');
      const cachee = /export const revalidate\s*=/.test(source);
      const parametresStatiques = /export\s+(async\s+)?function\s+generateStaticParams\b|export\s+const\s+generateStaticParams\b/.test(
        source,
      );

      if (segmentDynamique && cachee && !parametresStatiques) fautives.push(nom(fichier));
    }

    expect(
      fautives,
      `« revalidate » sans « generateStaticParams » : la route sera rendue à chaque appel malgré les apparences :\n${fautives.join('\n')}`,
    ).toStrictEqual([]);
  });

  it('garde toute route qui écrit en dynamique', () => {
    const fautives = FICHIERS.filter((fichier) => {
      const source = code(fichier);
      return ECRITURE.test(source) && !/export const dynamic\s*=\s*'force-dynamic'/.test(source);
    }).map(nom);

    expect(fautives, `écriture mise en cache :\n${fautives.join('\n')}`).toStrictEqual([]);
  });
});

describe('chaque écriture est authentifiée et comptée', () => {
  it('ne laisse aucune route d’écriture sans portier ni budget', () => {
    const fautives: string[] = [];

    for (const fichier of FICHIERS) {
      const source = code(fichier);
      if (!ECRITURE.test(source)) continue;

      // Les routes d'authentification ne peuvent pas exiger de jeton — c'est
      // justement ce qu'elles délivrent. Elles comptent alors par adresse
      // d'appel, faute de savoir qui parle.
      const authentification = fichier.includes(`${path.sep}auth${path.sep}`);

      const portier = /await\s+exiger(Porteur|Auteur|Lecteur)\s*\(/.test(source);
      const budget = /await\s+consommer\s*\(\s*BUDGETS\./.test(source);

      if (authentification) {
        // `session` (la déconnexion) est le seul cas sans budget : se
        // déconnecter doit toujours aboutir, et l'opération ne coûte qu'un
        // `delete` sur une clé primaire.
        if (!fichier.includes(`auth${path.sep}session`) && !budget) {
          fautives.push(`${nom(fichier)} — route d’authentification sans budget`);
        }
      } else if (!portier) {
        fautives.push(`${nom(fichier)} — écriture sans portier`);
      }
    }

    expect(fautives, `écriture non protégée :\n${fautives.join('\n')}`).toStrictEqual([]);
  });

  it('valide toute entrée par un schéma Zod', () => {
    const fautives = FICHIERS.filter((fichier) => {
      const source = code(fichier);
      if (!ECRITURE.test(source)) return false;
      // La déconnexion ne lit aucun corps : elle n'a rien à valider.
      if (fichier.includes(`auth${path.sep}session`)) return false;
      return !/\.safeParse\s*\(/.test(source);
    }).map(nom);

    expect(fautives, `entrée non validée par Zod :\n${fautives.join('\n')}`).toStrictEqual([]);
  });
});

describe('l’API n’est pas ouverte aux autres sites', () => {
  it('ne pose aucun en-tête CORS', () => {
    const fautives = FICHIERS.filter((fichier) =>
      /access-control-allow|Access-Control-Allow/i.test(lire(fichier)),
    ).map(nom);

    /*
      Une application mobile n'a pas besoin de CORS : elle n'a pas d'origine.
      Les navigateurs, eux, en ont une — et sans ces en-têtes, aucun autre
      site ne peut lire cette API depuis le navigateur de ses visiteurs. C'est
      voulu : le catalogue, les scores et les avis sont le produit, pas une
      source de données gratuite pour qui voudrait les republier.
    */
    expect(fautives, `en-tête CORS posé :\n${fautives.join('\n')}`).toStrictEqual([]);
  });
});

describe('« la position ne quitte jamais l’appareil »', () => {
  it('n’ouvre AUCUN point d’accès capable de recevoir une position', () => {
    /*
      ═══ La promesse, et ce qui la rend vraie ═══

      La page de confidentialité affirme que la position de l'appareil ne
      remonte pas au serveur. Sur le site, c'est tenu par le fait qu'aucune
      route ne sait en lire une — plus solide qu'une promesse de ne pas s'en
      servir. L'application mobile est exactement le moment où cette garantie
      risque de tomber : demander « les spots près de moi » au serveur serait
      la façon la plus naturelle de l'écrire, et la plus facile à justifier.

      La proximité se calcule donc SUR L'APPAREIL, contre le catalogue déjà
      téléchargé par `GET /api/v1/spots`. Ce test refuse qu'une route se mette
      un jour à accepter une latitude.
    */
    const fautives: string[] = [];

    const lecturesDEntree = [
      /searchParams\s*\.\s*get\s*\(\s*['"`](lat|lng|lon|latitude|longitude|coords?|position)/i,
      /formData?\s*\.\s*get\s*\(\s*['"`](lat|lng|lon|latitude|longitude|coords?|position)/i,
      /\b(lat|lng|latitude|longitude)\s*:\s*z\s*\./i,
    ];

    for (const fichier of routes(API)) {
      /*
        `/api/tuiles/[z]/[x]/[y]` est exempté, avec sa raison : ses
        coordonnées sont celles d'une TUILE de carte, c'est-à-dire du cadre
        regardé, pas de l'appareil. C'est même l'inverse d'une fuite — cette
        route existe pour que le navigateur ne parle jamais au fournisseur de
        fonds de carte, qui verrait sinon l'adresse IP du visiteur et la zone
        qu'il consulte, donc approximativement où il pêche.
      */
      if (fichier.includes(`${path.sep}tuiles${path.sep}`)) continue;

      const source = lire(fichier);
      for (const motif of lecturesDEntree) {
        if (motif.test(source)) fautives.push(`${nom(fichier)} → ${motif}`);
      }
    }

    expect(
      fautives,
      `point d’accès capable de recevoir une position :\n${fautives.join('\n')}`,
    ).toStrictEqual([]);
  });
});
