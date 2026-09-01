/**
 * Coefficient de marée français.
 *
 * Ce n'est ni une estimation ni une convention interne : le coefficient est
 * DÉFINI par le SHOM comme le rapport du marnage de Brest à son unité de
 * hauteur, ramené sur 100.
 *
 *     coefficient = 100 × marnage_Brest / (2 × U)     avec U = 3,05 m
 *
 * Deux conséquences pratiques :
 *
 *  - Le coefficient est NATIONAL. Il ne dépend pas du spot, seulement de la
 *    date et de Brest. Le calculer localement à partir du marnage de Wissant
 *    donnerait un nombre différent de celui de toutes les tables de marée
 *    françaises — l'erreur qu'on trouve dans beaucoup d'applications.
 *  - Il ne dépend que d'un MARNAGE, c'est-à-dire d'une différence de hauteurs.
 *    Il est donc insensible au zéro de référence : peu importe que le
 *    fournisseur rapporte ses hauteurs au niveau moyen ou au zéro des cartes.
 *    C'est ce qui rend ce calcul fiable même avec une source étrangère.
 */

/** Unité de hauteur de Brest, en mètres (SHOM). */
export const BREST_UNIT_HEIGHT_M = 3.05;

/** Port de référence du coefficient français. */
export const BREST_REFERENCE = {
  name: 'Brest',
  lat: 48.3833,
  lng: -4.4944,
} as const;

export interface TideExtreme {
  /** ISO. */
  time: string;
  heightM: number;
  type: 'high' | 'low';
}

export interface CoefficientPoint {
  /** Instant de la pleine mer concernée, en millisecondes epoch. */
  time: number;
  coefficient: number;
}

/** Convertit un marnage de Brest en coefficient, borné à l'échelle officielle 20–120. */
export function coefficientFromRange(rangeM: number): number {
  const raw = (100 * rangeM) / (2 * BREST_UNIT_HEIGHT_M);
  return Math.max(20, Math.min(120, Math.round(raw)));
}

/**
 * Table de coefficients déduite des extremums de Brest.
 *
 * Un coefficient est attaché à chaque pleine mer. Le marnage retenu est la
 * moyenne des écarts avec les basses mers qui l'encadrent : les deux ne sont pas
 * égaux, et n'en prendre qu'un seul décalerait le résultat de quelques points
 * selon le côté choisi.
 */
export function coefficientTable(extremes: readonly TideExtreme[]): CoefficientPoint[] {
  const sorted = [...extremes].sort(
    (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime(),
  );

  const points: CoefficientPoint[] = [];

  for (let i = 0; i < sorted.length; i += 1) {
    const current = sorted[i] as TideExtreme;
    if (current.type !== 'high') continue;

    const previous = sorted[i - 1];
    const next = sorted[i + 1];

    const ranges: number[] = [];
    if (previous && previous.type === 'low') ranges.push(Math.abs(current.heightM - previous.heightM));
    if (next && next.type === 'low') ranges.push(Math.abs(current.heightM - next.heightM));
    if (ranges.length === 0) continue;

    const meanRange = ranges.reduce((sum, value) => sum + value, 0) / ranges.length;

    points.push({
      time: new Date(current.time).getTime(),
      coefficient: coefficientFromRange(meanRange),
    });
  }

  return points;
}

/**
 * Coefficient applicable à un instant : celui de la pleine mer de Brest la plus
 * proche. `null` si la table est vide — on préfère l'absence à une valeur inventée.
 */
export function coefficientAt(instant: Date, table: readonly CoefficientPoint[]): number | null {
  if (table.length === 0) return null;

  const t = instant.getTime();
  let best = table[0] as CoefficientPoint;
  for (const point of table) {
    if (Math.abs(point.time - t) < Math.abs(best.time - t)) best = point;
  }
  return best.coefficient;
}
