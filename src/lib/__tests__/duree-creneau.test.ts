import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { SLOT_HOURS, SLOTS_PER_DAY } from '@/lib/forecast';

/*
  ────────────────────────────────────────────────────────────────────────────
   Le site annonçait une durée de créneau qu'il ne calculait pas.

   `SLOT_HOURS` vaut 2 depuis toujours. Pourtant la page d'accueil, sa balise
   de description — celle que Google affiche — et un guide annonçaient « un
   score par créneau de trois heures ». La page d'un spot parlait de « huit
   créneaux » là où il y en a douze.

   Personne ne l'aurait remarqué : le tableau n'affichait pas encore les
   horaires côte à côte. C'est exactement le genre d'écart qu'un site dont
   l'argument est de dire la vérité sur ses données ne peut pas se permettre —
   et il ne s'est pas créé d'un coup, il a survécu à un changement de durée.

   Ce test lit donc la constante et refuse toute phrase du dépôt qui associe un
   créneau à une AUTRE durée. La formulation suit le code, et non l'inverse.
  ────────────────────────────────────────────────────────────────────────────
*/

/** « créneau de trois heures », « tranche de 3 heures », « créneaux de 2 h »… */
const PHRASE = /(cr[ée]neaux?|tranches?)\s+de\s+([\wéè]+)\s*h(?:eures?)?\b/gi;

const NOMBRES: Record<string, number> = {
  une: 1, un: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6,
  '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6,
};

const RACINES = ['src'] as const;

/**
 * Retire les commentaires avant l'inspection.
 *
 * La règle porte sur ce que le site PUBLIE, pas sur ce que le code se raconte.
 * `slots.ts` explique très légitimement pourquoi « trois heures » a été écarté
 * — interdire la phrase là reviendrait à interdire d'expliquer la décision.
 * Les fichiers Markdown, eux, sont du contenu affiché : ils passent entiers.
 */
function sansCommentaires(source: string, fichier: string): string {
  if (fichier.endsWith('.md')) return source;

  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    // « // » précédé de « : » est une URL, pas un commentaire.
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function fichiers(dossier: string): string[] {
  const trouves: string[] = [];

  for (const entree of readdirSync(dossier, { withFileTypes: true })) {
    const chemin = join(dossier, entree.name);

    if (entree.isDirectory()) {
      // Les tests parlent des durées pour les décrire : les inclure ferait
      // échouer ce fichier sur sa propre documentation.
      if (entree.name !== '__tests__') trouves.push(...fichiers(chemin));
      continue;
    }

    if (/\.(ts|tsx|md)$/.test(entree.name)) trouves.push(chemin);
  }

  return trouves;
}

describe('la durée annoncée des créneaux suit SLOT_HOURS', () => {
  it('douze créneaux de deux heures, et rien d’autre dans le code', () => {
    expect(SLOT_HOURS).toBe(2);
    expect(SLOTS_PER_DAY).toBe(12);
  });

  it('aucune phrase du dépôt n’annonce une autre durée de créneau', () => {
    const fautes: string[] = [];

    for (const racine of RACINES) {
      for (const fichier of fichiers(racine)) {
        const source = sansCommentaires(readFileSync(fichier, 'utf8'), fichier);

        for (const trouve of source.matchAll(PHRASE)) {
          const mot = (trouve[2] ?? '').toLowerCase();
          const valeur = NOMBRES[mot];

          // Un mot qu'on ne sait pas lire n'est pas une faute : « créneau de
          // forte houle » n'annonce aucune durée.
          if (valeur === undefined) continue;
          if (valeur === SLOT_HOURS) continue;

          fautes.push(`${fichier} → « ${trouve[0]} »`);
        }
      }
    }

    expect(
      fautes,
      `${fautes.join('\n')}\n\n` +
        `Les créneaux durent ${SLOT_HOURS} h (SLOT_HOURS). Une page qui en annonce ` +
        'une autre décrit un site qui n’existe pas — et si la durée a changé, ' +
        'c’est cette constante qui fait foi, pas la phrase.',
    ).toStrictEqual([]);
  });
});
