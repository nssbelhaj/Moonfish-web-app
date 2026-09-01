import { clamp, fr, ramp, round1 } from '../math';
import type { AvailableFactorResult, FactorResult, SolunarInput } from '../types';
import { FACTOR_WEIGHTS, unavailableFactor } from '../types';

/** Durée d'une lunaison en jours. */
export const SYNODIC_MONTH_D = 29.53;

export type MoonPhaseName =
  | 'Nouvelle lune'
  | 'Premier croissant'
  | 'Premier quartier'
  | 'Lune gibbeuse croissante'
  | 'Pleine lune'
  | 'Lune gibbeuse décroissante'
  | 'Dernier quartier'
  | 'Dernier croissant';

export function moonPhaseName(ageDays: number): MoonPhaseName {
  const a = ((ageDays % SYNODIC_MONTH_D) + SYNODIC_MONTH_D) % SYNODIC_MONTH_D;
  if (a < 1.85 || a >= 27.68) return 'Nouvelle lune';
  if (a < 5.54) return 'Premier croissant';
  if (a < 9.23) return 'Premier quartier';
  if (a < 12.91) return 'Lune gibbeuse croissante';
  if (a < 16.61) return 'Pleine lune';
  if (a < 20.3) return 'Lune gibbeuse décroissante';
  if (a < 23.99) return 'Dernier quartier';
  return 'Dernier croissant';
}

/** Proximité d'une syzygie (nouvelle ou pleine lune), 0–1. */
export function syzygyProximity(ageDays: number): number {
  const a = ((ageDays % SYNODIC_MONTH_D) + SYNODIC_MONTH_D) % SYNODIC_MONTH_D;
  const toNew = Math.min(a, SYNODIC_MONTH_D - a);
  const toFull = Math.abs(a - SYNODIC_MONTH_D / 2);
  const distance = Math.min(toNew, toFull);
  return distance >= 3 ? 0 : ramp(distance, 0, 3, 1, 0);
}

export function scoreSolunar(input: SolunarInput): AvailableFactorResult;
export function scoreSolunar(input: SolunarInput | null): FactorResult;
export function scoreSolunar(input: SolunarInput | null): FactorResult {
  if (input === null) return unavailableFactor('solunar');

  // Période majeure : lune au zénith ou au nadir. La fenêtre porte ~2 h.
  const major = ramp(Math.abs(input.hoursToMajorPeriod), 0, 2.5, 1, 0.15);
  // Période mineure : lever et coucher de lune. Fenêtre plus courte et plus faible.
  const minor = 0.72 * ramp(Math.abs(input.hoursToMinorPeriod), 0, 1.5, 1, 0.2);

  const base = Math.max(major, minor);
  const syzygy = syzygyProximity(input.moonAgeDays);

  // Bonus nouvelle / pleine lune : marées plus vives, activité nocturne accrue.
  const score = 10 * clamp(base + 0.18 * syzygy, 0, 1);

  const phase = moonPhaseName(input.moonAgeDays);
  const inMajor = Math.abs(input.hoursToMajorPeriod) <= 1;
  const inMinor = Math.abs(input.hoursToMinorPeriod) <= 0.75;

  const window = inMajor
    ? 'en pleine période majeure'
    : inMinor
      ? 'en période mineure'
      : `à ${fr(Math.min(Math.abs(input.hoursToMajorPeriod), Math.abs(input.hoursToMinorPeriod)))} h de la prochaine période`;

  const note =
    syzygy > 0.5
      ? `${window} · ${phase.toLowerCase()}, coefficient de vive-eau`
      : `${window} · ${phase.toLowerCase()} (${Math.round(input.moonIlluminationPct)} %)`;

  return {
    score: round1(clamp(score, 0, 10)),
    weight: FACTOR_WEIGHTS.solunar,
    nominalWeight: FACTOR_WEIGHTS.solunar,
    note,
  };
}
