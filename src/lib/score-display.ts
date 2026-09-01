import type { ScoreLabel } from '@/lib/scoring';

export type ScoreTier = 1 | 2 | 3 | 4;

/**
 * Un palier porte QUATRE canaux redondants (R3) : chiffre, libellé, forme et
 * couleur. Test de recette : une capture en niveaux de gris doit rester lisible.
 *
 * L'échelle n'est PAS un dégradé rouge → vert (D5). Une telle échelle est
 * illisible en deutéranopie et confondrait le palier bas avec le danger — or le
 * rouge est réservé, exclusivement, à la sécurité. Les quatre paliers se
 * distinguent aussi par leur luminance, donc restent séparables en gris.
 */
export interface TierPresentation {
  tier: ScoreTier;
  label: ScoreLabel;
  /** Variable CSS du palier, valable dans les deux thèmes. */
  colorVar: string;
  shape: 'bar' | 'diamond' | 'disc' | 'target';
  /** Description de la forme, lue par les lecteurs d'écran. */
  shapeLabel: string;
}

const TIERS: Record<ScoreTier, TierPresentation> = {
  1: { tier: 1, label: 'Médiocre', colorVar: 'var(--score-1)', shape: 'bar', shapeLabel: 'trait plat' },
  2: { tier: 2, label: 'Passable', colorVar: 'var(--score-2)', shape: 'diamond', shapeLabel: 'losange creux' },
  3: { tier: 3, label: 'Bon', colorVar: 'var(--score-3)', shape: 'disc', shapeLabel: 'disque plein' },
  4: { tier: 4, label: 'Excellent', colorVar: 'var(--score-4)', shape: 'target', shapeLabel: 'cible annelée' },
};

/**
 * Couleur d'un score absent. Ni palier, ni danger : la même teinte que les crans
 * éteints de la réglette. Un score indisponible ne doit pas emprunter la couleur
 * du palier bas, qui affirmerait de mauvaises conditions (D11, D12).
 */
export const UNAVAILABLE_COLOR_VAR = 'var(--edge)';

export function tierFor(value: number): TierPresentation {
  if (value < 4) return TIERS[1];
  if (value < 6) return TIERS[2];
  if (value < 8) return TIERS[3];
  return TIERS[4];
}

/**
 * Activité d'un créneau, codée de 0 à 3 poissons.
 *
 * C'est le PALIER moins un : trois poissons pour « Excellent », deux pour
 * « Bon », un pour « Passable », aucun pour « Médiocre ». Le symbole n'est donc
 * pas une seconde information à apprendre, c'est le même palier lu autrement —
 * un canal redondant de plus, lisible d'un coup d'œil et en niveaux de gris.
 *
 * Zéro symbole pour le palier bas, plutôt qu'un poisson barré : une activité
 * faible se lit à l'absence, pas à un signe de plus (R6).
 */
export function activityLevel(value: number | null | undefined): 0 | 1 | 2 | 3 {
  const tier = tierForOrNull(value);
  if (tier === null) return 0;
  return (tier.tier - 1) as 0 | 1 | 2 | 3;
}

export const ACTIVITY_LABELS: Record<0 | 1 | 2 | 3, string> = {
  0: 'activité faible',
  1: 'activité moyenne',
  2: 'activité élevée',
  3: 'activité très élevée',
};

/** Palier d'une valeur éventuellement absente. `null` = il n'y a rien à qualifier. */
export function tierForOrNull(value: number | null | undefined): TierPresentation | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  return tierFor(value);
}

/**
 * Formats imposés (R12) : score à une décimale, virgule décimale, et
 * « —,— » pour une valeur absente — jamais 0, jamais un tiret seul (D12).
 * La forme garde la place et l'allure d'un nombre : la colonne ne se décale
 * pas, et l'œil comprend « valeur attendue, absente » sans lire.
 */
export function formatScore(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—,—';
  return value.toFixed(1).replace('.', ',');
}

/** Espace insécable avant l'unité (R12). */
const NBSP = '\u00a0';

export function formatMeasure(
  value: number | null | undefined,
  unit: string,
  decimals = 0,
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'Indispo.';
  return `${value.toFixed(decimals).replace('.', ',')}${NBSP}${unit}`;
}

/**
 * Nombre de crans allumés sur la réglette, sur 10.
 *
 * Troncature et jamais arrondi (D1) : 8,4 comme 8,9 allument 8 crans. Arrondir
 * 8,9 à 9 donnerait à la réglette l'image de 9,0 et la ferait contredire le
 * chiffre affiché juste à côté. La troncature dit « au moins 8 », ce qui est
 * toujours vrai.
 */
export function litNotches(value: number): number {
  return Math.max(0, Math.min(10, Math.floor(value)));
}
