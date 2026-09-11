import { describe, expect, it } from 'vitest';

import { SPOTS } from '@/data/spots';
import { regrouper } from '../regroupement';

/** Projection Web Mercator, comme Leaflet : ce qui compte est la distance en pixels à un zoom. */
function projeter(lat: number, lng: number, zoom: number): { x: number; y: number } {
  const echelle = 256 * 2 ** zoom;
  const x = ((lng + 180) / 360) * echelle;
  const s = Math.sin((lat * Math.PI) / 180);
  const y = (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * echelle;
  return { x, y };
}

describe('regrouper', () => {
  it('laisse seuls deux points éloignés', () => {
    const g = regrouper([{ x: 0, y: 0 }, { x: 200, y: 0 }], 40);
    expect(g.map((x) => x.membres)).toStrictEqual([[0], [1]]);
  });

  it('fond deux points qui se toucheraient', () => {
    const g = regrouper([{ x: 0, y: 0 }, { x: 20, y: 0 }], 40);
    expect(g).toHaveLength(1);
    expect(g[0]?.membres).toStrictEqual([0, 1]);
    expect(g[0]?.x).toBe(10);
  });

  it('range chaque point dans exactement un groupe', () => {
    const points = SPOTS.map((s) => projeter(s.lat, s.lng, 5));
    const groupes = regrouper(points, 44);
    const tous = groupes.flatMap((g) => g.membres).sort((a, b) => a - b);
    expect(tous).toStrictEqual(points.map((_, i) => i));
  });

  it('ne laisse jamais deux pastilles se chevaucher', () => {
    /*
      C'est la propriété qui a manqué à l'écartement : à quarante-deux spots
      sur un écran de téléphone, il restait des marqueurs à vingt pixels l'un
      de l'autre. Ici, à chaque zoom de la carte, deux centres de groupe sont
      à plus d'un rayon.
    */
    for (const zoom of [4, 5, 6, 7, 8, 9, 10]) {
      const groupes = regrouper(SPOTS.map((s) => projeter(s.lat, s.lng, zoom)), 44);
      for (let i = 0; i < groupes.length; i++) {
        for (let j = i + 1; j < groupes.length; j++) {
          const a = groupes[i];
          const b = groupes[j];
          if (a === undefined || b === undefined) continue;
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          expect(d, `zoom ${zoom} : groupes ${i} et ${j} à ${d.toFixed(1)} px`).toBeGreaterThanOrEqual(44);
        }
      }
    }
  });

  it('sépare tout le monde une fois assez près', () => {
    // À zoom 12, Agadir et Taghazout — quinze kilomètres — sont à des centaines de pixels.
    const groupes = regrouper(SPOTS.map((s) => projeter(s.lat, s.lng, 12)), 44);
    expect(groupes).toHaveLength(SPOTS.length);
  });

  it('regroupe vraiment à l’échelle du continent', () => {
    // Le but même : à l'échelle où France et Maroc tiennent ensemble, la
    // carte doit montrer une poignée de pastilles, pas quarante-deux.
    const groupes = regrouper(SPOTS.map((s) => projeter(s.lat, s.lng, 5)), 44);
    expect(groupes.length).toBeLessThan(SPOTS.length / 2);
  });

  it('est déterministe', () => {
    const points = SPOTS.map((s) => projeter(s.lat, s.lng, 6));
    expect(regrouper(points, 44)).toStrictEqual(regrouper(points, 44));
  });
});
