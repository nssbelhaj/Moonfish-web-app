import { describe, expect, it } from 'vitest';

import { separatePoints } from '../projection';

/*
  ────────────────────────────────────────────────────────────────────────────
   Ce que ces tests protègent, en une phrase : un marqueur qu'on ne peut pas
   cliquer.

   Agadir et Taghazout sont à quinze kilomètres. À l'échelle où la France et le
   Maroc tiennent sur le même écran, cela fait moins d'un marqueur d'écart, et
   l'un recouvrait l'autre ENTIÈREMENT. Constaté dans un vrai navigateur : une
   tentative de clic sur Taghazout atterrissait sur Agadir.

   La garantie utile n'est pas « les points ont bougé » mais « aucune paire ne
   reste plus proche que la distance demandée ». C'est elle qui est vérifiée
   ici, y compris dans les cas qui font tomber une implémentation naïve.
  ────────────────────────────────────────────────────────────────────────────
*/

function plusPetitEcart(points: readonly { x: number; y: number }[]): number {
  let min = Infinity;

  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const a = points[i]!;
      const b = points[j]!;
      min = Math.min(min, Math.hypot(b.x - a.x, b.y - a.y));
    }
  }

  return min;
}

describe('separatePoints garantit un écart minimal', () => {
  it('sépare deux points qui se recouvrent presque', () => {
    const sortie = separatePoints(
      [
        { x: 100, y: 100 },
        { x: 104, y: 103 },
      ],
      38,
    );

    expect(plusPetitEcart(sortie)).toBeGreaterThanOrEqual(37.9);
  });

  it('sépare deux points EXACTEMENT confondus', () => {
    /*
      Le cas qui divise par zéro : sans direction fabriquée, les deux points
      restent l'un sur l'autre et le défaut d'origine subsiste — précisément
      dans la situation la plus grave.
    */
    const sortie = separatePoints(
      [
        { x: 50, y: 50 },
        { x: 50, y: 50 },
      ],
      38,
    );

    expect(Number.isFinite(sortie[0]!.x)).toBe(true);
    expect(plusPetitEcart(sortie)).toBeGreaterThanOrEqual(37.9);
  });

  it('sépare un amas dense de douze points', () => {
    // Douze spots tassés dans 30 px : le pire cas réaliste, quand la carte est
    // dézoomée au maximum.
    const amas = Array.from({ length: 12 }, (_, i) => ({
      x: 200 + (i % 4) * 8,
      y: 200 + Math.floor(i / 4) * 8,
    }));

    expect(plusPetitEcart(separatePoints(amas, 38, 200))).toBeGreaterThanOrEqual(37.9);
  });

  it('ne touche pas à des points déjà assez espacés', () => {
    // L'écartement doit DISPARAÎTRE quand on zoome. Un algorithme qui déplace
    // même sans collision ferait dériver les marqueurs à chaque niveau de zoom,
    // et la carte finirait par mentir partout au lieu de nulle part.
    const espaces = [
      { x: 0, y: 0 },
      { x: 200, y: 0 },
      { x: 0, y: 200 },
    ];

    expect(separatePoints(espaces, 38)).toStrictEqual(espaces);
  });

  it('conserve les champs annexes de chaque point', () => {
    // Les marqueurs transportent leur identité : la perdre en chemin
    // rattacherait un score au mauvais spot.
    const sortie = separatePoints(
      [
        { x: 10, y: 10, slug: 'pen-hat' },
        { x: 12, y: 11, slug: 'le-dossen' },
      ],
      38,
    );

    expect(sortie.map((p) => p.slug)).toStrictEqual(['pen-hat', 'le-dossen']);
  });

  it('est déterministe : deux appels donnent le même résultat', () => {
    const entree = [
      { x: 5, y: 5 },
      { x: 6, y: 5 },
      { x: 5, y: 6 },
    ];

    expect(separatePoints(entree, 38)).toStrictEqual(separatePoints(entree, 38));
  });

  it('ne modifie pas le tableau reçu', () => {
    const entree = [
      { x: 1, y: 1 },
      { x: 2, y: 2 },
    ];
    const copie = structuredClone(entree);

    separatePoints(entree, 38);
    expect(entree).toStrictEqual(copie);
  });
});
