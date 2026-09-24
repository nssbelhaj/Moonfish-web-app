import { describe, expect, it } from 'vitest';

import { FICHES_REGIONS, REGIONS, ficheRegionDe, regionDe, regionPath } from '@/data/regions';
import { PAYS } from '@/data/spots';

/**
 * Une page région sans fiche serait un filtre déguisé en page ; une fiche sans
 * région serait du texte que personne ne lit. Les deux listes se recouvrent
 * exactement, ou le test le dit.
 */
describe('les régions du catalogue', () => {
  it('sont toutes décrites, et aucune fiche n’est orpheline', () => {
    for (const region of REGIONS) {
      expect(() => ficheRegionDe(region.slug), `fiche manquante : ${region.slug}`).not.toThrow();
    }
    const slugs = new Set(REGIONS.map((region) => region.slug));
    for (const slug of Object.keys(FICHES_REGIONS)) {
      expect(slugs.has(slug), `fiche orpheline : ${slug}`).toBe(true);
    }
  });

  it('couvrent tous les spots, chacun une fois', () => {
    const total = REGIONS.reduce((somme, region) => somme + region.spots.length, 0);
    expect(total).toBe(PAYS.reduce((somme, pays) => somme + pays.spots.length, 0));
    for (const region of REGIONS) {
      expect(region.spots.length).toBeGreaterThan(0);
      for (const spot of region.spots) {
        expect(spot.regionSlug).toBe(region.slug);
        expect(spot.countrySlug).toBe(region.pays.slug);
      }
    }
  });

  it('ont un slug unique au sein de leur pays, et un chemin qui le porte', () => {
    for (const region of REGIONS) {
      expect(regionDe(region.pays.slug, region.slug)).toBe(region);
      expect(regionPath(region.pays.slug, region.slug)).toBe(`/spots/${region.pays.slug}/${region.slug}`);
    }
    expect(regionDe('france', 'galicia')).toBeNull();
  });

  it('ont des fiches en trois paragraphes qui disent quelque chose', () => {
    for (const fiche of Object.values(FICHES_REGIONS)) {
      expect(fiche.titre).toMatch(/^Pêcher du bord /);
      for (const texte of [fiche.accroche, fiche.terrain, fiche.conseil]) {
        expect(texte.length, `${fiche.slug} : paragraphe trop court`).toBeGreaterThan(120);
      }
      // Aucune promesse de prise : la mer décide.
      expect(`${fiche.accroche} ${fiche.terrain} ${fiche.conseil}`).not.toMatch(/garanti|assuré|à coup sûr/i);
    }
  });
});
