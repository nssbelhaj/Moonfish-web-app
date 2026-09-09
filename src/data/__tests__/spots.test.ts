import { describe, expect, it } from 'vitest';

import { SPOTS } from '@/data/spots';

/*
  ────────────────────────────────────────────────────────────────────────────
   Le catalogue est du contenu éditorial écrit à la main. Zod valide les
   FORMES au chargement — une latitude est bien un nombre entre -90 et 90.
   Il ne peut rien dire des CONTENUS : une latitude juste mais fausse passe.

   Ces tests attrapent la classe d'erreurs qu'une relecture ne voit pas, parce
   qu'elle demande de comparer un chiffre à une carte : un spot marocain aux
   coordonnées espagnoles, un fuseau qui ne correspond pas au pays, une façade
   déclarée méditerranéenne à l'ouest de Gibraltar.
  ────────────────────────────────────────────────────────────────────────────
*/

/** Cadre de chaque pays couvert, large mais fermé. */
const CADRES: Record<string, { lat: [number, number]; lng: [number, number] }> = {
  france: { lat: [41, 51.5], lng: [-5.5, 9.9] },
  espagne: { lat: [35.9, 43.9], lng: [-9.4, 4.4] },
  maroc: { lat: [20.5, 36], lng: [-17.5, -0.9] },
};

/** Fuseau attendu par pays. Un fuseau faux décale TOUS les horaires affichés. */
const FUSEAUX: Record<string, string> = {
  france: 'Europe/Paris',
  espagne: 'Europe/Madrid',
  maroc: 'Africa/Casablanca',
};

/**
 * Longitude du détroit de Gibraltar.
 *
 * Rien de méditerranéen ne se trouve à l'ouest. Le contrôle ne vaut que dans
 * ce sens : la mer du Nord est atlantique pour la réglementation et se trouve
 * très à l'est, donc « atlantique ⇒ à l'ouest » serait faux.
 */
const GIBRALTAR_LNG = -5.61;

describe('le catalogue de spots', () => {
  it('n’a aucun slug en double : deux spots au même slug, et l’un des deux disparaît', () => {
    const slugs = SPOTS.map((s) => s.slug);
    const doublons = slugs.filter((slug, i) => slugs.indexOf(slug) !== i);
    expect(doublons).toStrictEqual([]);
  });

  it.each(SPOTS.map((s) => [s.name, s] as const))('%s est dans son pays', (_nom, spot) => {
    const cadre = CADRES[spot.countrySlug];
    expect(cadre, `pays « ${spot.countrySlug} » sans cadre déclaré`).toBeDefined();

    expect(spot.lat).toBeGreaterThanOrEqual(cadre!.lat[0]);
    expect(spot.lat).toBeLessThanOrEqual(cadre!.lat[1]);
    expect(spot.lng).toBeGreaterThanOrEqual(cadre!.lng[0]);
    expect(spot.lng).toBeLessThanOrEqual(cadre!.lng[1]);
  });

  it.each(SPOTS.map((s) => [s.name, s] as const))('%s porte le fuseau de son pays', (_nom, spot) => {
    expect(spot.timezone).toBe(FUSEAUX[spot.countrySlug]);
  });

  it('ne place aucun spot méditerranéen à l’ouest de Gibraltar', () => {
    const impossibles = SPOTS.filter((s) => s.sea === 'mediterranee' && s.lng < GIBRALTAR_LNG);
    expect(impossibles.map((s) => `${s.name} (${s.lng})`)).toStrictEqual([]);
  });

  it('donne un marnage cohérent avec la façade', () => {
    /*
      La Méditerranée a un marnage de quelques décimètres ; l'Atlantique se
      compte en mètres. Une inversion ferait calculer des marées absurdes sans
      lever la moindre erreur — le score dépend directement de ce chiffre.
    */
    for (const spot of SPOTS) {
      if (spot.sea === 'mediterranee') {
        expect(spot.meanTideRangeM, spot.name).toBeLessThan(1);
      } else {
        expect(spot.meanTideRangeM, spot.name).toBeGreaterThan(0.8);
      }
    }
  });

  it('couvre les trois pays annoncés', () => {
    const parPays = new Map<string, number>();
    for (const spot of SPOTS) parPays.set(spot.countrySlug, (parPays.get(spot.countrySlug) ?? 0) + 1);

    expect([...parPays.keys()].sort()).toStrictEqual(['espagne', 'france', 'maroc']);
    for (const [pays, n] of parPays) expect(n, pays).toBeGreaterThanOrEqual(10);
  });

  it('décrit chaque spot ET son accès : une fiche sans accès n’aide personne', () => {
    for (const spot of SPOTS) {
      expect(spot.summary.length, spot.name).toBeGreaterThan(80);
      expect(spot.access.length, spot.name).toBeGreaterThan(60);
    }
  });
});
