import type { ScoreLabel } from '@/lib/scoring';

export type ScoreTier = 'bad' | 'mid' | 'good' | 'best';

/**
 * Un palier porte QUATRE canaux redondants (handoff §2.3) : le chiffre, le
 * libellé, la forme et la couleur. Un daltonien, un écran à contre-jour ou une
 * capture en niveaux de gris doivent tous laisser passer l'information.
 */
export interface TierPresentation {
  tier: ScoreTier;
  label: ScoreLabel;
  /** Variable CSS de la couleur du palier, valable dans les deux thèmes. */
  colorVar: string;
  /** Forme associée, seule à changer d'un palier à l'autre. */
  shape: 'square' | 'diamond' | 'disc' | 'target';
  /** Description de la forme, lue par les lecteurs d'écran. */
  shapeLabel: string;
}

const TIERS: Record<ScoreTier, TierPresentation> = {
  bad: { tier: 'bad', label: 'Mauvais', colorVar: 'var(--score-bad)', shape: 'square', shapeLabel: 'carré' },
  mid: { tier: 'mid', label: 'Moyen', colorVar: 'var(--score-mid)', shape: 'diamond', shapeLabel: 'losange' },
  good: { tier: 'good', label: 'Bon', colorVar: 'var(--score-good)', shape: 'disc', shapeLabel: 'disque' },
  best: { tier: 'best', label: 'Excellent', colorVar: 'var(--score-best)', shape: 'target', shapeLabel: 'cible annelée' },
};

export function tierFor(value: number): TierPresentation {
  if (value < 4) return TIERS.bad;
  if (value < 6) return TIERS.mid;
  if (value < 8) return TIERS.good;
  return TIERS.best;
}

/**
 * Formatage d'un score.
 * Une donnée absente s'affiche « —,— », jamais 0 : un 0 est un score (handoff §5).
 */
export function formatScore(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—,—';
  return value.toFixed(1).replace('.', ',');
}

/** Idem pour toute mesure : l'absence se dit, elle ne se remplace pas par zéro. */
export function formatMeasure(
  value: number | null | undefined,
  unit: string,
  decimals = 0,
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'Indispo.';
  return `${value.toFixed(decimals).replace('.', ',')} ${unit}`;
}

/**
 * Nombre de crans allumés sur la réglette, sur 10.
 * Troncature et non arrondi : 8,4 allume 8 crans. Jamais d'arrondi visuel
 * généreux (handoff §5) — la réglette ne doit pas flatter le score.
 */
export function litNotches(value: number): number {
  return Math.max(0, Math.min(10, Math.floor(value)));
}
