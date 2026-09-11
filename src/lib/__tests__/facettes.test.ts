import { describe, expect, it } from 'vitest';

import { SPOTS } from '@/data/spots';
import {
  EMPTY_FILTERS,
  applyFilters,
  correspond,
  optionsFacette,
  toFacette,
  type SpotFilters,
} from '@/lib/spot-filters';

/**
 * Le serveur filtre avec `applyFilters` ; le navigateur, avec `correspond`
 * sur une forme légère du spot. Si les deux divergeaient, la liste rendue au
 * serveur et celle affichée après un clic ne seraient pas la même — et
 * personne ne le verrait sans comparer les deux sur tout le catalogue.
 */
const FACETTES = SPOTS.map(toFacette);

function toutesLesCombinaisons(): SpotFilters[] {
  const pays = [null, ...new Set(SPOTS.map((s) => s.countrySlug))];
  const regions = [null, ...new Set(SPOTS.map((s) => s.regionSlug))];
  const types = [null, ...new Set(SPOTS.map((s) => s.type))];
  const fonds = [null, ...new Set(SPOTS.map((s) => s.bottom))];
  const techniques = [null, ...new Set(SPOTS.flatMap((s) => s.techniques))];

  const combinaisons: SpotFilters[] = [];
  for (const country of pays)
    for (const region of regions)
      for (const type of types)
        for (const bottom of fonds)
          for (const technique of techniques) {
            combinaisons.push({ country, region, type, bottom, technique });
          }
  return combinaisons;
}

describe('les facettes', () => {
  it('filtrent exactement comme le serveur, sur toutes les combinaisons', () => {
    for (const f of toutesLesCombinaisons()) {
      const serveur = applyFilters(SPOTS, f).map((s) => s.slug);
      const client = FACETTES.filter((s) => correspond(s, f)).map((s) => s.slug);
      expect(client, JSON.stringify(f)).toStrictEqual(serveur);
    }
  });

  it('recomptent une facette contre les AUTRES filtres, pas contre elle-même', () => {
    // Maroc choisi : les régions françaises tombent à zéro, mais restent
    // listées — et « Maroc » lui-même garde son compte, sinon on ne pourrait
    // plus le désélectionner en connaissance de cause.
    const f: SpotFilters = { ...EMPTY_FILTERS, country: 'maroc' };
    const regions = optionsFacette(FACETTES, f, 'region', (s) => [[s.region, s.regionNom]]);
    const bretagne = regions.find((o) => o.value === 'bretagne');
    expect(bretagne?.count).toBe(0);
    expect(regions.some((o) => o.count > 0)).toBe(true);

    const pays = optionsFacette(FACETTES, f, 'country', (s) => [[s.pays, s.paysNom]]);
    expect(pays.find((o) => o.value === 'france')?.count).toBe(
      SPOTS.filter((s) => s.countrySlug === 'france').length,
    );
  });

  it('comptent une technique une fois par spot, pas une fois par mention', () => {
    const techniques = optionsFacette(FACETTES, EMPTY_FILTERS, 'technique', (s) =>
      s.techniques.map((t) => [t, t] as const),
    );
    for (const o of techniques) {
      expect(o.count).toBe(SPOTS.filter((s) => s.techniques.includes(o.value as never)).length);
    }
  });

  it('trient les options en français, accents compris', () => {
    const regions = optionsFacette(FACETTES, EMPTY_FILTERS, 'region', (s) => [[s.region, s.regionNom]]);
    const labels = regions.map((o) => o.label);
    expect(labels).toStrictEqual([...labels].sort((a, b) => a.localeCompare(b, 'fr')));
  });
});
