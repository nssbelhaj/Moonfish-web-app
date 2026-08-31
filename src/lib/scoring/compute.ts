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
 * Paliers du handoff §1 : 0–3 Mauvais · 4–5 Moyen · 6–7 Bon · 8–10 Excellent.
 * Le score portant une décimale, les bornes sont posées sur l'entier supérieur
 * pour qu'aucune valeur ne tombe entre deux paliers.
 */
export function labelFor(value: number): ScoreLabel {
  if (value < 4) return 'Mauvais';
  if (value < 6) return 'Moyen';
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
