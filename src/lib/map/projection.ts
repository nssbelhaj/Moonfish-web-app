import type { Spot } from '@/data/schemas';

export interface Viewport {
  width: number;
  height: number;
  /** Marge intérieure, pour que les pastilles ne touchent pas les bords. */
  padding: number;
}

export interface Projected {
  spot: Spot;
  x: number;
  y: number;
}

/**
 * Projection équirectangulaire d'un ensemble de spots dans un viewBox.
 *
 * Les longitudes sont corrigées par le cosinus de la latitude moyenne : sans
 * cela, un degré de longitude et un degré de latitude occuperaient la même
 * largeur à l'écran, et la France apparaîtrait étirée d'un tiers en largeur.
 *
 * L'échelle est UNIQUE pour les deux axes, choisie sur la dimension la plus
 * contraignante, puis le résultat est centré. Deux échelles différentes
 * feraient tenir la boîte au pixel près mais déformeraient les distances — or
 * la seule chose que cette carte prétend dire, c'est où les spots sont les uns
 * par rapport aux autres.
 */
export function projectSpots(spots: readonly Spot[], view: Viewport): Projected[] {
  if (spots.length === 0) return [];

  const lats = spots.map((s) => s.lat);
  const lngs = spots.map((s) => s.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  const midLat = (minLat + maxLat) / 2;
  const kx = Math.cos((midLat * Math.PI) / 180);

  const spanX = Math.max((maxLng - minLng) * kx, 1e-6);
  const spanY = Math.max(maxLat - minLat, 1e-6);

  const usableW = view.width - view.padding * 2;
  const usableH = view.height - view.padding * 2;
  const scale = Math.min(usableW / spanX, usableH / spanY);

  const offsetX = view.padding + (usableW - spanX * scale) / 2;
  const offsetY = view.padding + (usableH - spanY * scale) / 2;

  return spots.map((spot) => ({
    spot,
    x: offsetX + (spot.lng - minLng) * kx * scale,
    // L'axe des y d'un SVG descend : la latitude s'inverse.
    y: offsetY + (maxLat - spot.lat) * scale,
  }));
}

/**
 * Hauteur de viewBox qui respecte la forme des données.
 *
 * Le catalogue s'étend sur une vingtaine de degrés de latitude pour moins de
 * sept de longitude corrigée : dans un cadre plus large que haut, les douze
 * spots se tassaient en un paquet illisible où trois pastilles se recouvraient.
 * Le cadre suit donc la géométrie du jeu, borné pour rester manipulable.
 */
export function viewHeightFor(spots: readonly Spot[], width: number): number {
  if (spots.length < 2) return Math.round(width * 0.82);

  const lats = spots.map((s) => s.lat);
  const lngs = spots.map((s) => s.lng);
  const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const kx = Math.cos((midLat * Math.PI) / 180);

  const spanX = Math.max((Math.max(...lngs) - Math.min(...lngs)) * kx, 1e-6);
  const spanY = Math.max(Math.max(...lats) - Math.min(...lats), 1e-6);

  const ratio = Math.min(Math.max(spanY / spanX, 0.7), 2.2);
  return Math.round(width * ratio);
}

/**
 * Écarte les marqueurs qui se recouvrent, sans casser l'ordre géographique.
 *
 * Quelques passes de relaxation : deux pastilles trop proches se repoussent le
 * long de la droite qui les joint, d'une fraction de leur recouvrement. Le
 * déplacement reste petit et symétrique, si bien qu'un spot ne traverse jamais
 * son voisin — la carte reste une carte, pas un diagramme réarrangé.
 */
export function spreadMarkers(
  points: readonly Projected[],
  minDistance: number,
  view: Viewport,
  passes = 24,
): Projected[] {
  const out = points.map((p) => ({ ...p }));

  for (let pass = 0; pass < passes; pass++) {
    let moved = false;
    for (let i = 0; i < out.length; i++) {
      for (let j = i + 1; j < out.length; j++) {
        const a = out[i]!;
        const b = out[j]!;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        if (d >= minDistance) continue;

        // Deux points exactement confondus n'ont pas de direction : on en
        // fabrique une, déterministe, plutôt que de diviser par zéro.
        const ux = d < 1e-6 ? Math.cos(i) : dx / d;
        const uy = d < 1e-6 ? Math.sin(i) : dy / d;
        const push = (minDistance - d) / 2;

        a.x -= ux * push;
        a.y -= uy * push;
        b.x += ux * push;
        b.y += uy * push;
        moved = true;
      }
    }
    if (!moved) break;
  }

  const min = view.padding;
  return out.map((p) => ({
    ...p,
    x: Math.min(Math.max(p.x, min), view.width - min),
    y: Math.min(Math.max(p.y, min), view.height - min),
  }));
}

/** Forme du marqueur par type de spot (D8) : trois canaux avec le chiffre et la couleur. */
export type MarkerShape = 'cercle' | 'carre' | 'triangle';

export const MARKER_SHAPES: Record<Spot['type'], MarkerShape> = {
  plage: 'cercle',
  'estran-rocheux': 'cercle',
  pointe: 'triangle',
  estuaire: 'carre',
  digue: 'triangle',
};

export const MARKER_SHAPE_LABELS: Record<MarkerShape, string> = {
  cercle: 'cercle',
  carre: 'carré',
  triangle: 'triangle',
};
