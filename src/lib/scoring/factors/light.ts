import { round1 } from '../math';
import type { AvailableFactorResult, FactorResult, LightInput, LightPhase } from '../types';
import { FACTOR_WEIGHTS, unavailableFactor } from '../types';

/**
 * Le bar et la plupart des prédateurs du bord chassent dans la lumière basse.
 * Le plein jour n'est pas nul, il est simplement le moins favorable.
 */
const LIGHT_SCORES: Record<LightPhase, number> = {
  dawn: 10,
  dusk: 9.5,
  night: 7,
  day: 3.5,
};

const LIGHT_NOTES: Record<LightPhase, string> = {
  dawn: 'aube — la meilleure lumière du cycle pour le bord',
  dusk: 'crépuscule — bascule favorable, les prédateurs remontent',
  night: 'nuit — favorable, surtout sur les fonds de sable',
  day: 'plein jour — la lumière rase manque, activité en retrait',
};

export function scoreLight(input: LightInput): AvailableFactorResult;
export function scoreLight(input: LightInput | null): FactorResult;
export function scoreLight(input: LightInput | null): FactorResult {
  if (input === null) return unavailableFactor('light');

  return {
    score: round1(LIGHT_SCORES[input.phase]),
    weight: FACTOR_WEIGHTS.light,
    nominalWeight: FACTOR_WEIGHTS.light,
    note: LIGHT_NOTES[input.phase],
  };
}
