import type { ScoreInput } from '../types';

/**
 * Créneau de référence : tout est bon, rien n'est extrême.
 * Chaque test part de cette base et ne dégrade qu'UNE dimension, pour que
 * l'effet mesuré soit imputable au facteur testé et pas à un cumul.
 */
export const IDEAL: ScoreInput = {
  spotFacingDeg: 270, // plage exposée plein ouest
  tide: { hoursFromHighTide: -1, coefficient: 82, state: 'rising' },
  wind: { speedKmh: 16, fromDeg: 270 }, // 16 km/h plein ouest = vent de mer
  swell: { heightM: 1, periodS: 10 },
  solunar: {
    hoursToMajorPeriod: 0.3,
    hoursToMinorPeriod: 4,
    moonIlluminationPct: 98,
    moonAgeDays: 14.8,
  },
  light: { phase: 'dawn' },
};

/** Clone la base en ne remplaçant que les blocs fournis. */
export function withInput(patch: Partial<ScoreInput>): ScoreInput {
  return { ...IDEAL, ...patch };
}
