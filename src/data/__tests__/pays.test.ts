import { describe, expect, it } from 'vitest';

import { CATALOGUE, PAYS, PREPOSITIONS_PAYS, SPOTS } from '@/data/spots';

/**
 * Le regroupement par pays alimente le sélecteur de la page d'accueil, ses
 * compteurs et ses vignettes. Il est DÉRIVÉ du catalogue pour la même raison
 * que `CATALOGUE.total` : « 20 spots en France » écrit à la main serait faux
 * au premier spot ajouté, sans que rien ne le signale.
 */

describe('PAYS', () => {
  it('couvre exactement le catalogue, sans perte ni doublon', () => {
    const total = PAYS.reduce((somme, pays) => somme + pays.spots.length, 0);
    expect(total).toBe(CATALOGUE.total);
    expect(total).toBe(SPOTS.length);

    const slugs = PAYS.flatMap((pays) => pays.spots.map((spot) => spot.slug));
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('n’a qu’une entrée par pays', () => {
    const slugs = PAYS.map((pays) => pays.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('ne range un spot que sous son propre pays', () => {
    for (const pays of PAYS) {
      for (const spot of pays.spots) {
        expect(spot.countrySlug).toBe(pays.slug);
        expect(spot.countryName).toBe(pays.nom);
      }
    }
  });

  it('liste les régions de chaque pays, sans doublon', () => {
    for (const pays of PAYS) {
      expect(new Set(pays.regions).size).toBe(pays.regions.length);
      expect(new Set(pays.spots.map((spot) => spot.regionName))).toStrictEqual(
        new Set(pays.regions),
      );
    }
  });

  it('a une préposition déclarée pour chaque pays', () => {
    /*
      « en France » mais « au Maroc » : aucune règle mécanique ne le donne.
      Un pays ajouté sans sa préposition doit faire échouer ce test, pas
      produire « en Maroc » dans une balise title.
    */
    for (const pays of PAYS) {
      expect(PREPOSITIONS_PAYS[pays.slug], `préposition manquante : ${pays.slug}`).toBeDefined();
    }
  });

  it('compose l’étendue du catalogue dans l’ordre réel des pays', () => {
    /*
      La phrase était écrite à la main — « en France, en Espagne et au
      Maroc » — avec un commentaire affirmant qu'elle suivait l'ordre du
      catalogue. Le catalogue range le Maroc AVANT l'Espagne. Personne ne
      pouvait le voir : les deux textes vivaient à trente lignes l'un de
      l'autre et étaient cohérents chacun avec lui-même.
    */
    for (const pays of PAYS) {
      expect(CATALOGUE.etendue, `${pays.nom} absent de l’étendue`).toContain(
        PREPOSITIONS_PAYS[pays.slug]!,
      );
    }

    const positions = PAYS.map((pays) => CATALOGUE.etendue.indexOf(PREPOSITIONS_PAYS[pays.slug]!));
    expect(positions, 'l’étendue ne suit pas l’ordre du catalogue').toStrictEqual(
      [...positions].sort((a, b) => a - b),
    );
  });
});
