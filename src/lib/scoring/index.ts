export { computeScore, labelFor } from './compute';
export { evaluateSafety } from './safety';
export { buildReasons } from './reasons';
export { classifyWind, WIND_EXPOSURE_LABEL, WIND_BAD_KMH, WIND_DANGER_KMH } from './factors/wind';
export type { WindExposure } from './factors/wind';
export { SWELL_CAUTION_M, SWELL_DANGER_M, SWELL_TOO_CALM_M } from './factors/swell';
export { moonPhaseName, syzygyProximity, SYNODIC_MONTH_D } from './factors/solunar';
export type { MoonPhaseName } from './factors/solunar';
export { coefficientFactor, tidePositionFactor } from './factors/tide';
export { FACTOR_LABELS, FACTOR_WEIGHTS } from './types';
export type {
  FactorResult,
  LightInput,
  LightPhase,
  SafetyLevel,
  ScoreFactor,
  ScoreInput,
  ScoreLabel,
  ScoreResult,
  SolunarInput,
  SwellInput,
  TideInput,
  TideState,
  WindInput,
} from './types';
