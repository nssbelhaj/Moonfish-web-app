import { computeScore } from '../compute';
import type { ScoreInput } from '../types';

/**
 * Créneau de référence : tout est bon, rien n'est extrême.
 * Chaque test part de cette base et ne dégrade qu'UNE dimension, pour que
 * l'effet mesuré soit imputable au facteur testé et pas à un cumul.
 */
export const IDEAL = {
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
  pressure: { hPa: 1014, trend3hHpa: -1.2 },
  light: { phase: 'dawn' },
  // `satisfies` plutôt qu'une annotation : les blocs restent typés NON NULS, si
  // bien qu'un test peut écrire `...IDEAL.solunar` sans avoir à écarter un
  // `null` que cette base n'a jamais.
} satisfies ScoreInput;

/** Clone la base en ne remplaçant que les blocs fournis. */
export function withInput(patch: Partial<ScoreInput>): ScoreInput {
  return { ...IDEAL, ...patch };
}

/**
 * Score d'une entrée COMPLÈTE, garanti non nul.
 * Si `computeScore` rendait `null` ici, c'est le test qui serait faux : toutes
 * les sources sont fournies. On échoue donc bruyamment plutôt que de masquer
 * le cas avec un `?? 0` qui inventerait une valeur.
 */
export function scoreOf(input: ScoreInput): number {
  const { value } = computeScore(input);
  if (value === null) {
    throw new Error('score nul sur une entrée complète : la base de test est incohérente');
  }
  return value;
}
