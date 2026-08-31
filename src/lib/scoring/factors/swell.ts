import { clamp, fr, ramp, round1, trapezoid } from '../math';
import type { FactorResult, SwellInput } from '../types';
import { FACTOR_WEIGHTS } from '../types';

/** Sous ce seuil, la mer est trop lisse pour brasser le bord. */
export const SWELL_TOO_CALM_M = 0.3;
/** Vigilance : le bord devient inconfortable (handoff §3). */
export const SWELL_CAUTION_M = 2.0;
/** Danger, non négociable (spec + handoff §3). */
export const SWELL_DANGER_M = 2.5;

export function scoreSwell(input: SwellInput): FactorResult {
  const h = Math.max(0, input.heightM);

  // 0,5–1,5 m = optimal ; < 0,3 m trop calme ; > 2,5 m mauvais.
  let score = 10 * trapezoid(h, 0.05, 0.5, 1.5, 2.7);

  // Une mer d'huile reste pêchable : plancher plutôt que zéro.
  if (h < SWELL_TOO_CALM_M) score = Math.max(score, ramp(h, 0, SWELL_TOO_CALM_M, 2.2, 3.4));

  // Une longue période porte mieux qu'un clapot court à hauteur égale.
  const periodBonus = input.periodS >= 9 ? 0.4 : input.periodS <= 4 ? -0.6 : 0;
  score += periodBonus;

  if (h > SWELL_DANGER_M) score = Math.min(score, 1.2);

  const hm = fr(h);
  const note =
    h > SWELL_DANGER_M
      ? `${hm} m — au-delà du seuil de sécurité, le bord n'est plus tenable`
      : h >= SWELL_CAUTION_M
        ? `${hm} m — mer formée, vigilance sur les zones de déferlement`
        : h < SWELL_TOO_CALM_M
          ? `${hm} m — trop calme, l'eau ne se trouble pas`
          : h >= 0.5 && h <= 1.5
            ? `${hm} m à ${Math.round(input.periodS)} s — état de mer idéal pour le bord`
            : `${hm} m à ${Math.round(input.periodS)} s`;

  return { score: round1(clamp(score, 0, 10)), weight: FACTOR_WEIGHTS.swell, note };
}
