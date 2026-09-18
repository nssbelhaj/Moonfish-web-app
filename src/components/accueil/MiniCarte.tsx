/**
 * La constellation des spots d'un pays, en SVG pur.
 *
 * ─── Pourquoi pas une carte ───────────────────────────────────────────────
 *
 * La demande était « une petite carte cliquable par pays ». La réponse
 * évidente — un fond de carte en tuiles — coûte trois requêtes réseau par
 * vignette, un composant client, et une dépendance de rendu avant que la
 * page d'accueil n'ait dit quoi que ce soit d'utile. Pour une vignette de
 * 120 px, c'est cher payé.
 *
 * Ici, on ne dessine PAS le pays : on dessine ses spots, projetés à leurs
 * vraies coordonnées. À vingt points, le trait du littoral apparaît de
 * lui-même — la Manche, la façade atlantique, la Méditerranée se lisent —
 * et ce trait-là est exact, parce qu'il n'est fait que de positions réelles.
 * Un contour approximatif dessiné à la main, lui, serait faux d'une manière
 * que personne ne pourrait corriger.
 *
 * Aucune couleur en dur : le point vaut `currentColor`, donc il suit le
 * thème du bloc qui le contient, clair comme sombre.
 */

export interface PointCarte {
  slug: string;
  name: string;
  lat: number;
  lng: number;
}

const COTE = 100;
/** Marge intérieure, pour qu'un spot en bord de boîte ne soit pas rogné. */
const MARGE = 10;

interface Projete {
  slug: string;
  name: string;
  x: number;
  y: number;
}

/**
 * Projection équirectangulaire, avec la correction de longitude en cosinus de
 * latitude. Sans elle, la France est étirée d'un tiers en largeur : un degré
 * de longitude à 48° N ne mesure que les deux tiers d'un degré de latitude.
 */
export function projeter(points: readonly PointCarte[]): Projete[] {
  if (points.length === 0) return [];

  const latMoyenne = points.reduce((total, p) => total + p.lat, 0) / points.length;
  const cos = Math.cos((latMoyenne * Math.PI) / 180);

  const bruts = points.map((p) => ({ ...p, u: p.lng * cos, v: -p.lat }));

  const uMin = Math.min(...bruts.map((p) => p.u));
  const uMax = Math.max(...bruts.map((p) => p.u));
  const vMin = Math.min(...bruts.map((p) => p.v));
  const vMax = Math.max(...bruts.map((p) => p.v));

  // Une seule échelle pour les deux axes : deux échelles déformeraient le
  // pays pour remplir la boîte, ce qui est précisément ce qu'une carte ne
  // doit pas faire.
  const etendue = Math.max(uMax - uMin, vMax - vMin, 1e-9);
  const echelle = (COTE - 2 * MARGE) / etendue;

  // Ce qui reste de la boîte après mise à l'échelle est réparti également de
  // part et d'autre : le pays est centré, pas collé en haut à gauche.
  const restantX = COTE - 2 * MARGE - (uMax - uMin) * echelle;
  const restantY = COTE - 2 * MARGE - (vMax - vMin) * echelle;

  return bruts.map((p) => ({
    slug: p.slug,
    name: p.name,
    x: MARGE + restantX / 2 + (p.u - uMin) * echelle,
    y: MARGE + restantY / 2 + (p.v - vMin) * echelle,
  }));
}

export function MiniCarte({ points, label }: { points: readonly PointCarte[]; label: string }) {
  const projetes = projeter(points);

  return (
    <svg
      viewBox={`0 0 ${COTE} ${COTE}`}
      className="h-full w-full text-accent"
      role="img"
      aria-label={label}
    >
      {projetes.map((p) => (
        <circle key={p.slug} cx={p.x} cy={p.y} r={3.2} fill="currentColor" opacity={0.75}>
          <title>{p.name}</title>
        </circle>
      ))}
    </svg>
  );
}
