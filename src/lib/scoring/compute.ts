import { scoreLight } from './factors/light';
import { scorePressure } from './factors/pressure';
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

const FACTORS: readonly ScoreFactor[] = ['tide', 'wind', 'swell', 'solunar', 'pressure', 'light'];

/**
 * Le score Moonfish.
 *
 * Fonction pure : mêmes entrées, même sortie, aucun accès réseau, horloge ou
 * système de fichiers. Tout ce dont elle a besoin est dans `input`.
 *
 * Sources manquantes (D11) : un facteur dont la source est indisponible sort du
 * calcul et les poids des facteurs restants sont RENORMALISÉS, de sorte que le
 * total reste sur 10 et reste comparable d'un créneau à l'autre. Les deux
 * alternatives sont pires : une valeur par défaut fabriquerait une condition
 * qu'on n'a pas mesurée, un zéro affirmerait une mauvaise condition tout aussi
 * inventée. `coverage` dit ce qui a réellement été couvert, et `reasons` le dit
 * en français à l'utilisateur : le score ne se présente jamais comme complet
 * quand il ne l'est pas.
 */
export function computeScore(input: ScoreInput): ScoreResult {
  const scored: Record<ScoreFactor, FactorResult> = {
    tide: scoreTide(input.tide),
    wind: scoreWind(input.wind, input.spotFacingDeg),
    swell: scoreSwell(input.swell),
    solunar: scoreSolunar(input.solunar),
    pressure: scorePressure(input.pressure),
    light: scoreLight(input.light),
  };

  const nominalTotal = FACTORS.reduce((sum, factor) => sum + scored[factor].nominalWeight, 0);
  const availableTotal = FACTORS.reduce(
    (sum, factor) => (scored[factor].score === null ? sum : sum + scored[factor].nominalWeight),
    0,
  );

  // Poids effectifs : la part de chaque facteur disponible dans ce qui reste.
  // Somme exactement 1 dès qu'au moins un facteur est disponible.
  const breakdown = FACTORS.reduce<Record<ScoreFactor, FactorResult>>(
    (acc, factor) => {
      const entry = scored[factor];
      acc[factor] = {
        ...entry,
        weight: entry.score === null || availableTotal === 0 ? 0 : entry.nominalWeight / availableTotal,
      };
      return acc;
    },
    { ...scored },
  );

  const missing = FACTORS.filter((factor) => breakdown[factor].score === null);
  const coverage = nominalTotal === 0 ? 0 : availableTotal / nominalTotal;

  // La sécurité est évaluée dans tous les cas, y compris sans aucun facteur :
  // c'est justement là qu'elle doit refuser de dire « ok ».
  const safety = evaluateSafety(input);

  if (availableTotal === 0) {
    return {
      value: null,
      label: null,
      coverage: 0,
      reasons: buildReasons(breakdown, null, safety, missing),
      breakdown,
      safety,
    };
  }

  const weighted = FACTORS.reduce((total, factor) => {
    const entry = breakdown[factor];
    return entry.score === null ? total : total + entry.score * entry.weight;
  }, 0);

  const value = round1(clamp(weighted, 0, 10));
  const label = labelFor(value);

  return {
    value,
    label,
    coverage,
    reasons: buildReasons(breakdown, label, safety, missing),
    breakdown,
    safety,
  };
}
