import { describe, expect, it } from 'vitest';
import { SPOTS } from '@/data/spots';
import { applyFilters, EMPTY_FILTERS, filtersToSearchParams, parseFilters } from '../spot-filters';

describe('filtres de spots', () => {
  it('lit la technique depuis l’URL', () => {
    const filters = parseFilters({ technique: 'rockfishing' }, SPOTS);
    expect(filters.technique).toBe('rockfishing');
  });

  it('ignore une technique inconnue plutôt que de vider la liste', () => {
    // /spots?technique=harpon doit afficher les 12 spots, pas une page morte.
    const filters = parseFilters({ technique: 'harpon' }, SPOTS);
    expect(filters.technique).toBeNull();
    expect(applyFilters(SPOTS, filters)).toHaveLength(SPOTS.length);
  });

  it('retient les spots où la technique est réellement praticable', () => {
    const filters = { ...EMPTY_FILTERS, technique: 'shore-jigging' };
    const matching = applyFilters(SPOTS, filters);

    expect(matching.length).toBeGreaterThan(0);
    expect(matching.length).toBeLessThan(SPOTS.length);
    for (const spot of matching) {
      expect(spot.techniques).toContain('shore-jigging');
    }
  });

  it('combine technique et région', () => {
    const matching = applyFilters(SPOTS, {
      ...EMPTY_FILTERS,
      technique: 'surfcasting',
      region: 'bretagne',
    });
    for (const spot of matching) {
      expect(spot.regionSlug).toBe('bretagne');
      expect(spot.techniques).toContain('surfcasting');
    }
  });

  it('réécrit la technique dans l’URL canonique', () => {
    const params = filtersToSearchParams({ ...EMPTY_FILTERS, technique: 'peche-a-pied' });
    expect(params.toString()).toBe('technique=peche-a-pied');
  });

  it('donne au moins une technique à chacun des 12 spots', () => {
    for (const spot of SPOTS) {
      expect(spot.techniques.length).toBeGreaterThan(0);
    }
  });
});
