import { angleDelta, clamp, round1, trapezoid } from '../math';
import type { FactorResult, WindInput } from '../types';
import { FACTOR_WEIGHTS } from '../types';

/**
 * Le pêcheur ne cherche pas des degrés, il cherche à savoir si le vent lui
 * arrive dans le dos ou dans la figure (handoff §5). On qualifie donc le vent
 * relativement au cap du spot vers le large.
 */
export type WindExposure = 'mer' | 'travers' | 'terre';

export const WIND_EXPOSURE_LABEL: Record<WindExposure, string> = {
  mer: 'vent de mer',
  travers: 'vent de travers',
  terre: 'vent de terre',
};

/**
 * `fromDeg` est la direction D'OÙ VIENT le vent, `spotFacingDeg` le cap de la
 * plage vers le large. Si les deux coïncident, le vent vient du large : vent de mer.
 */
export function classifyWind(fromDeg: number, spotFacingDeg: number): WindExposure {
  const delta = angleDelta(fromDeg, spotFacingDeg);
  if (delta <= 60) return 'mer';
  if (delta >= 120) return 'terre';
  return 'travers';
}

/** Seuil au-delà duquel une sortie du bord devient franchement mauvaise. */
export const WIND_BAD_KMH = 40;
/** Seuil de danger, non négociable (spec + handoff §3). */
export const WIND_DANGER_KMH = 50;

function speedFit(speedKmh: number, exposure: WindExposure): number {
  switch (exposure) {
    // 10–25 km/h de secteur mer = optimal : ça brasse, ça trouble, ça active le poisson.
    case 'mer':
      return trapezoid(speedKmh, 1, 10, 25, 44);
    case 'travers':
      return 0.9 * trapezoid(speedKmh, 1, 9, 22, 40);
    // Vent de terre modéré = correct : mer plate, lancers longs, mais moins d'activité.
    case 'terre':
      return 0.78 * trapezoid(speedKmh, 0, 4, 18, 36);
  }
}

export function scoreWind(input: WindInput, spotFacingDeg: number): FactorResult {
  const exposure = classifyWind(input.fromDeg, spotFacingDeg);
  const speed = Math.max(0, input.speedKmh);

  let score = 10 * speedFit(speed, exposure);

  // Plafonds durs : au-delà de 40 km/h, aucune exposition ne rattrape la sortie.
  if (speed > WIND_BAD_KMH) score = Math.min(score, 2.4);
  if (speed > WIND_DANGER_KMH) score = Math.min(score, 0.8);

  const label = WIND_EXPOSURE_LABEL[exposure];
  const rounded = Math.round(speed);
  const note =
    speed > WIND_DANGER_KMH
      ? `${rounded} km/h de ${label} — au-delà du seuil de sécurité, sortie déconseillée`
      : speed > WIND_BAD_KMH
        ? `${rounded} km/h de ${label} — trop fort pour lancer et tenir une ligne`
        : exposure === 'mer' && speed >= 10 && speed <= 25
          ? `${rounded} km/h de ${label} — plage idéale, l'eau se trouble et le poisson monte`
          : exposure === 'terre'
            ? `${rounded} km/h de ${label} — mer aplatie, lancers faciles mais moins d'activité`
            : `${rounded} km/h de ${label}`;

  return { score: round1(clamp(score, 0, 10)), weight: FACTOR_WEIGHTS.wind, note };
}
