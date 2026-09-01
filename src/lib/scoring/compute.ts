import { scoreLight } from './factors/light';
import { scoreSolunar } from './factors/solunar';
import { scoreSwell } from './factors/swell';
import { scoreTide } from './factors/tide';
import { scoreWind } from './factors/wind';
import { clamp, round1 } from './math';
import { buildReasons } from './reasons';
import { evaluateSafety } from './safety';
import type { FactorResult, ScoreFactor, ScoreLabel, ScoreInput, ScoreResult } from './types';

/**
 * Paliers du handoff v2 : 0–3,9 Médiocre · 4–5,9 Passable · 6–7,9 Bon ·
 * 8–10 Excellent. Les bornes sont exclusives en haut, si bien qu'aucune valeur
 * décimale ne tombe entre deux paliers.
 */
export function labelFor(value: number): ScoreLabel {
  if (value < 4) return 'Médiocre';
  if (value < 6) return 'Passable';
  if (value < 8) return 'Bon';
  return 'Excellent';
}

/**
 * Le score Moonfish.
 *
 * Fonction pure : mêmes entrées, même sortie, aucun accès réseau, horloge ou
 * système de fichiers. Tout ce dont elle a besoin est dans `input`.
 */
export function computeScore(input: ScoreInput): ScoreResult {
  const breakdown: Record<ScoreFactor, FactorResult> = {
    tide: scoreTide(input.tide),
    wind: scoreWind(input.wind, input.spotFacingDeg),
    swell: scoreSwell(input.swell),
    solunar: scoreSolunar(input.solunar),
    light: scoreLight(input.light),
  };

  const weighted = (Object.keys(breakdown) as ScoreFactor[]).reduce((total, factor) => {
    const entry = breakdown[factor];
    return total + entry.score * entry.weight;
  }, 0);

  const value = round1(clamp(weighted, 0, 10));
  const label = labelFor(value);
  const safety = evaluateSafety(input);

  return {
    value,
    label,
    reasons: buildReasons(breakdown, label, safety),
    breakdown,
    safety,
  };
}
