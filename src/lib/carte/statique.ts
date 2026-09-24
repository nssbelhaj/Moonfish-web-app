/**
 * La géométrie d'une carte statique : Web Mercator, tuiles, cadrage.
 *
 * ─── Pourquoi une carte à tuiles, et plus une constellation ──────────────
 *
 * La première version projetait les spots seuls, sans fond, en pariant que
 * « le littoral apparaît de lui-même ». À vingt points, on devinait la
 * France ; à cinq, on voyait cinq points. Un lecteur ne doit pas deviner.
 *
 * Le fond vient d'OpenStreetMap par NOTRE proxy `/api/tuiles` — déjà en
 * place pour la carte interactive, avec son cache et son attribution. Les
 * spots sont projetés dans la même Mercator que les tuiles, dans un seul
 * SVG : un point est au pixel près sur sa côte.
 *
 * Module pur, sans DOM : testé sur des nombres.
 */

const TUILE = 256;

export interface PointGeo {
  lat: number;
  lng: number;
}

/** Coordonnées en pixels-monde au zoom `z` (origine en haut à gauche). */
export function mercator(point: PointGeo, z: number): { x: number; y: number } {
  const n = TUILE * 2 ** z;
  const latRad = (Math.max(-85.05, Math.min(85.05, point.lat)) * Math.PI) / 180;
  return {
    x: ((point.lng + 180) / 360) * n,
    y: ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n,
  };
}

export interface Cadrage {
  z: number;
  /** Tuiles à charger : colonnes et lignes incluses. */
  tuiles: { x0: number; x1: number; y0: number; y1: number };
  /** Fenêtre visible, en pixels-monde au zoom `z`. */
  vue: { x: number; y: number; largeur: number; hauteur: number };
}

/**
 * Le cadrage qui montre tous les points avec une marge, au zoom le plus fin
 * qui tient dans `tuilesMax` tuiles — le coût réseau est borné par
 * construction, pas par espoir.
 *
 * `ratio` (largeur / hauteur) est imposé : la boîte est élargie dans la
 * dimension qui manque, centrée sur les points. Une vignette carrée reste
 * carrée quel que soit le pays.
 */
export function cadrer(
  points: readonly PointGeo[],
  options: { tuilesMax: number; ratio: number; marge?: number; zMin?: number; zMax?: number },
): Cadrage | null {
  if (points.length === 0) return null;
  const marge = options.marge ?? 0.12;
  const zMin = options.zMin ?? 3;
  const zMax = options.zMax ?? 9;

  let retenu: Cadrage | null = null;
  /*
    Si même le zoom le plus grossier ne tient pas dans `tuilesMax` — une
    boîte qui chevauche une frontière de tuiles en fait quatre d'un coup —
    on le rend quand même : quatre tuiles au zoom 3, c'est le pire cas, et
    c'est borné.
  */
  let plancher: Cadrage | null = null;

  for (let z = zMin; z <= zMax; z += 1) {
    const projetes = points.map((p) => mercator(p, z));
    const xs = projetes.map((p) => p.x);
    const ys = projetes.map((p) => p.y);
    let x0 = Math.min(...xs);
    let x1 = Math.max(...xs);
    let y0 = Math.min(...ys);
    let y1 = Math.max(...ys);

    // Marge proportionnelle, avec un plancher : un seul point doit quand
    // même montrer un peu de côte autour de lui.
    const largeurBrute = Math.max(x1 - x0, TUILE * 0.5);
    const hauteurBrute = Math.max(y1 - y0, TUILE * 0.5);
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    let largeur = largeurBrute * (1 + 2 * marge);
    let hauteur = hauteurBrute * (1 + 2 * marge);

    // Ratio imposé : on élargit la dimension qui manque.
    if (largeur / hauteur > options.ratio) hauteur = largeur / options.ratio;
    else largeur = hauteur * options.ratio;

    x0 = cx - largeur / 2;
    x1 = cx + largeur / 2;
    y0 = cy - hauteur / 2;
    y1 = cy + hauteur / 2;

    const n = 2 ** z;
    const tuiles = {
      x0: Math.max(0, Math.floor(x0 / TUILE)),
      x1: Math.min(n - 1, Math.floor((x1 - 1e-9) / TUILE)),
      y0: Math.max(0, Math.floor(y0 / TUILE)),
      y1: Math.min(n - 1, Math.floor((y1 - 1e-9) / TUILE)),
    };
    const combien = (tuiles.x1 - tuiles.x0 + 1) * (tuiles.y1 - tuiles.y0 + 1);

    const cadrage: Cadrage = { z, tuiles, vue: { x: x0, y: y0, largeur, hauteur } };
    if (plancher === null) plancher = cadrage;
    if (combien <= options.tuilesMax) retenu = cadrage;
    else break;
  }

  return retenu ?? plancher;
}

/** Les tuiles d'un cadrage, avec leur position en pixels-monde. */
export function tuilesDe(cadrage: Cadrage): { z: number; x: number; y: number; px: number; py: number }[] {
  const out: { z: number; x: number; y: number; px: number; py: number }[] = [];
  for (let y = cadrage.tuiles.y0; y <= cadrage.tuiles.y1; y += 1) {
    for (let x = cadrage.tuiles.x0; x <= cadrage.tuiles.x1; x += 1) {
      out.push({ z: cadrage.z, x, y, px: x * TUILE, py: y * TUILE });
    }
  }
  return out;
}

export const TAILLE_TUILE = TUILE;
