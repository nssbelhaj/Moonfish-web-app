import { describe, expect, it } from 'vitest';

import { PAYS } from '@/data/spots';
import { cadrer, mercator, tuilesDe } from '../statique';

describe('mercator', () => {
  it('place l’équateur au milieu et Greenwich au milieu', () => {
    const p = mercator({ lat: 0, lng: 0 }, 3);
    expect(p.x).toBeCloseTo((256 * 8) / 2, 6);
    expect(p.y).toBeCloseTo((256 * 8) / 2, 6);
  });

  it('met le nord en haut et l’est à droite', () => {
    const brest = mercator({ lat: 48.38, lng: -4.49 }, 5);
    const agadir = mercator({ lat: 30.42, lng: -9.6 }, 5);
    expect(brest.y).toBeLessThan(agadir.y);
    expect(brest.x).toBeGreaterThan(agadir.x);
  });

  it('borne la latitude pour ne jamais rendre l’infini', () => {
    expect(Number.isFinite(mercator({ lat: 90, lng: 0 }, 3).y)).toBe(true);
  });
});

describe('cadrer', () => {
  it('ne dépasse jamais le nombre de tuiles demandé, pour chaque pays', () => {
    for (const pays of PAYS) {
      for (const tuilesMax of [2, 4, 9, 12]) {
        const cadrage = cadrer(pays.spots, { tuilesMax, ratio: 1 });
        expect(cadrage, `${pays.slug} sans cadrage pour ${tuilesMax} tuiles`).not.toBeNull();
        // Au pire, les quatre tuiles du zoom le plus grossier : borné.
        expect(tuilesDe(cadrage!).length).toBeLessThanOrEqual(Math.max(tuilesMax, 4));
      }
    }
  });

  it('montre TOUS les points dans la fenêtre, avec de la marge', () => {
    for (const pays of PAYS) {
      const cadrage = cadrer(pays.spots, { tuilesMax: 9, ratio: 1.2 })!;
      for (const spot of pays.spots) {
        const p = mercator(spot, cadrage.z);
        expect(p.x).toBeGreaterThan(cadrage.vue.x);
        expect(p.x).toBeLessThan(cadrage.vue.x + cadrage.vue.largeur);
        expect(p.y).toBeGreaterThan(cadrage.vue.y);
        expect(p.y).toBeLessThan(cadrage.vue.y + cadrage.vue.hauteur);
      }
    }
  });

  it('impose le ratio demandé', () => {
    const cadrage = cadrer(PAYS[0]!.spots, { tuilesMax: 9, ratio: 1.5 })!;
    expect(cadrage.vue.largeur / cadrage.vue.hauteur).toBeCloseTo(1.5, 6);
  });

  it('prend le zoom le plus fin qui tient : plus de tuiles permises, plus de zoom', () => {
    const large = cadrer(PAYS[0]!.spots, { tuilesMax: 2, ratio: 1 })!;
    const fin = cadrer(PAYS[0]!.spots, { tuilesMax: 12, ratio: 1 })!;
    expect(fin.z).toBeGreaterThanOrEqual(large.z);
  });

  it('couvre la fenêtre visible avec les tuiles retenues', () => {
    const cadrage = cadrer(PAYS[1]!.spots, { tuilesMax: 9, ratio: 1 })!;
    const tuiles = tuilesDe(cadrage);
    const minPx = Math.min(...tuiles.map((t) => t.px));
    const maxPx = Math.max(...tuiles.map((t) => t.px)) + 256;
    expect(minPx).toBeLessThanOrEqual(cadrage.vue.x);
    expect(maxPx).toBeGreaterThanOrEqual(cadrage.vue.x + cadrage.vue.largeur - 1e-6);
  });

  it('rend null sans point, et un cadrage même pour un point seul', () => {
    expect(cadrer([], { tuilesMax: 4, ratio: 1 })).toBeNull();
    expect(cadrer([{ lat: 48, lng: -4 }], { tuilesMax: 4, ratio: 1 })).not.toBeNull();
  });
});
