import { describe, expect, it } from 'vitest';
import { SPOTS } from '@/data/spots';
import { MARKER_SHAPES, projectSpots, spreadMarkers, viewHeightFor } from '../projection';

const VIEW = { width: 390, height: 320, padding: 28 };

describe('projection des spots', () => {
  const projected = projectSpots(SPOTS, VIEW);

  it('place chaque spot dans le cadre, marges comprises', () => {
    for (const p of projected) {
      expect(p.x).toBeGreaterThanOrEqual(VIEW.padding - 0.001);
      expect(p.x).toBeLessThanOrEqual(VIEW.width - VIEW.padding + 0.001);
      expect(p.y).toBeGreaterThanOrEqual(VIEW.padding - 0.001);
      expect(p.y).toBeLessThanOrEqual(VIEW.height - VIEW.padding + 0.001);
    }
  });

  it('respecte l’ordre nord-sud', () => {
    // L'axe des y d'un SVG descend : le spot le plus au nord doit être le plus haut.
    const nord = projected.reduce((a, b) => (a.spot.lat > b.spot.lat ? a : b));
    const sud = projected.reduce((a, b) => (a.spot.lat < b.spot.lat ? a : b));
    expect(nord.y).toBeLessThan(sud.y);
  });

  it('respecte l’ordre est-ouest', () => {
    const ouest = projected.reduce((a, b) => (a.spot.lng < b.spot.lng ? a : b));
    const est = projected.reduce((a, b) => (a.spot.lng > b.spot.lng ? a : b));
    expect(ouest.x).toBeLessThan(est.x);
  });

  it('garde une échelle unique sur les deux axes', () => {
    // Deux échelles feraient tenir la boîte au pixel près mais déformeraient les
    // distances — or c'est la seule chose que cette carte prétend dire.
    //
    // La référence est le MODÈLE de la projection : longitudes corrigées par le
    // cosinus de la latitude MOYENNE. Comparer à la distance géodésique vraie
    // échouerait de 5 % sur ce catalogue, non par un défaut du code mais parce
    // qu'une projection équirectangulaire déforme sur 19° de latitude. C'est
    // acceptable pour une carte de repérage, et la légende le dit.
    const midLat =
      (Math.min(...SPOTS.map((s) => s.lat)) + Math.max(...SPOTS.map((s) => s.lat))) / 2;
    const kx = Math.cos((midLat * Math.PI) / 180);
    const [a, b, c] = projected;
    const model = (p: typeof a, q: typeof a) =>
      Math.hypot((p!.spot.lng - q!.spot.lng) * kx, p!.spot.lat - q!.spot.lat);
    const px = (p: typeof a, q: typeof a) => Math.hypot(p!.x - q!.x, p!.y - q!.y);
    expect(px(a, b) / model(a, b)).toBeCloseTo(px(a, c) / model(a, c), 6);
  });

  it('corrige la longitude par la latitude', () => {
    // Sans le cosinus, un degré de longitude prendrait autant de large qu'un
    // degré de latitude, et la carte serait étirée en largeur.
    const haut = projectSpots(
      [
        { ...SPOTS[0]!, lat: 60, lng: 0 },
        { ...SPOTS[1]!, lat: 60.5, lng: 0.5 },
      ],
      VIEW,
    );
    const dx = Math.abs(haut[0]!.x - haut[1]!.x);
    const dy = Math.abs(haut[0]!.y - haut[1]!.y);
    // À 60°, un degré de longitude vaut la moitié d'un degré de latitude.
    expect(dx).toBeLessThan(dy);
  });

  it('rend une liste vide sans planter', () => {
    expect(projectSpots([], VIEW)).toStrictEqual([]);
  });

  it('donne une forme à chaque type de spot (D8)', () => {
    for (const spot of SPOTS) {
      expect(MARKER_SHAPES[spot.type]).toBeDefined();
    }
  });
});

describe('lisibilité de la carte', () => {
  it('suit la forme des données plutôt qu’un cadre fixe', () => {
    // Le catalogue s'étend sur une vingtaine de degrés de latitude pour moins de
    // sept de longitude : dans un cadre plus large que haut, les douze spots se
    // tassaient en un paquet où trois pastilles se recouvraient.
    const h = viewHeightFor(SPOTS, 390);
    expect(h).toBeGreaterThan(390);
    // Borné, pour rester manipulable au pouce.
    expect(h).toBeLessThanOrEqual(390 * 2.2 + 1);
  });

  it('reste raisonnable pour un seul spot', () => {
    expect(viewHeightFor([SPOTS[0]!], 390)).toBeGreaterThan(200);
  });

  it('écarte les marqueurs qui se recouvrent', () => {
    const view = { width: 390, height: viewHeightFor(SPOTS, 390), padding: 24 };
    const spread = spreadMarkers(projectSpots(SPOTS, view), 36, view);

    for (let i = 0; i < spread.length; i++) {
      for (let j = i + 1; j < spread.length; j++) {
        const d = Math.hypot(spread[i]!.x - spread[j]!.x, spread[i]!.y - spread[j]!.y);
        // Tolérance : le rabattement dans le cadre peut rapprocher deux voisins
        // d'un cheveu. Ce qui compte est qu'aucune pastille n'en cache une autre.
        expect(d).toBeGreaterThan(24);
      }
    }
  });

  it('garde tout le monde dans le cadre après écartement', () => {
    const view = { width: 390, height: viewHeightFor(SPOTS, 390), padding: 24 };
    for (const p of spreadMarkers(projectSpots(SPOTS, view), 36, view)) {
      expect(p.x).toBeGreaterThanOrEqual(view.padding - 0.001);
      expect(p.x).toBeLessThanOrEqual(view.width - view.padding + 0.001);
      expect(p.y).toBeGreaterThanOrEqual(view.padding - 0.001);
      expect(p.y).toBeLessThanOrEqual(view.height - view.padding + 0.001);
    }
  });

  it('ne divise jamais par zéro sur deux spots confondus', () => {
    const view = { width: 390, height: 320, padding: 24 };
    const same = [
      { spot: SPOTS[0]!, x: 100, y: 100 },
      { spot: SPOTS[1]!, x: 100, y: 100 },
    ];
    for (const p of spreadMarkers(same, 36, view)) {
      expect(Number.isFinite(p.x)).toBe(true);
      expect(Number.isFinite(p.y)).toBe(true);
    }
  });
});
