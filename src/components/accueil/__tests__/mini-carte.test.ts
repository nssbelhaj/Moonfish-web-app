import { describe, expect, it } from 'vitest';

import { PAYS } from '@/data/spots';
import { projeter } from '../MiniCarte';

/**
 * La vignette de chaque pays n'est pas une illustration : ce sont les spots,
 * à leurs vraies coordonnées. Une projection qui déformerait le pays pour
 * remplir la boîte en ferait une illustration — et une illustration fausse.
 */

describe('projeter', () => {
  it('rend une boîte vide sans aucun point', () => {
    expect(projeter([])).toStrictEqual([]);
  });

  it('garde tous les points dans la boîte, marge comprise', () => {
    for (const pays of PAYS) {
      const points = projeter(
        pays.spots.map((spot) => ({
          slug: spot.slug,
          name: spot.name,
          lat: spot.lat,
          lng: spot.lng,
        })),
      );

      for (const point of points) {
        expect(point.x, `${point.slug} sort de la boîte en x`).toBeGreaterThanOrEqual(10);
        expect(point.x).toBeLessThanOrEqual(90);
        expect(point.y, `${point.slug} sort de la boîte en y`).toBeGreaterThanOrEqual(10);
        expect(point.y).toBeLessThanOrEqual(90);
      }
    }
  });

  it('conserve les proportions : une même échelle pour les deux axes', () => {
    /*
      Un degré de latitude et un degré de longitude CORRIGÉ du cosinus doivent
      produire le même écart à l'écran. Sans cette correction, la France est
      étirée d'un tiers en largeur — un degré de longitude à 48° N ne mesure
      que les deux tiers d'un degré de latitude.

      Les quatre points sont choisis pour que leur latitude moyenne tombe
      exactement sur 48° : c'est elle que la projection emploie, et un
      échantillon déséquilibré la déplacerait.
    */
    const lat = 48;
    const cos = Math.cos((lat * Math.PI) / 180);
    const points = projeter([
      { slug: 'centre', name: 'centre', lat, lng: 0 },
      { slug: 'sud', name: 'sud', lat: lat - 1, lng: 0 },
      { slug: 'nord', name: 'nord', lat: lat + 1, lng: 0 },
      { slug: 'est', name: 'est', lat, lng: 1 / cos },
    ]);

    const trouve = (slug: string) => points.find((p) => p.slug === slug)!;
    const deuxDegresEnY = Math.abs(trouve('nord').y - trouve('sud').y);
    const unDegreEnX = Math.abs(trouve('est').x - trouve('centre').x);

    expect(deuxDegresEnY).toBeCloseTo(2 * unDegreEnX, 6);
  });

  it('met le nord en haut', () => {
    const points = projeter([
      { slug: 'sud', name: 'sud', lat: 40, lng: 0 },
      { slug: 'nord', name: 'nord', lat: 50, lng: 0 },
    ]);
    const nord = points.find((p) => p.slug === 'nord')!;
    const sud = points.find((p) => p.slug === 'sud')!;
    expect(nord.y).toBeLessThan(sud.y);
  });

  it('met l’est à droite', () => {
    const points = projeter([
      { slug: 'ouest', name: 'ouest', lat: 45, lng: -5 },
      { slug: 'est', name: 'est', lat: 45, lng: 5 },
    ]);
    const est = points.find((p) => p.slug === 'est')!;
    const ouest = points.find((p) => p.slug === 'ouest')!;
    expect(est.x).toBeGreaterThan(ouest.x);
  });

  it('ne perd ni ne duplique aucun spot', () => {
    for (const pays of PAYS) {
      const points = projeter(
        pays.spots.map((spot) => ({
          slug: spot.slug,
          name: spot.name,
          lat: spot.lat,
          lng: spot.lng,
        })),
      );
      expect(points).toHaveLength(pays.spots.length);
      expect(new Set(points.map((p) => p.slug)).size).toBe(pays.spots.length);
    }
  });
});
