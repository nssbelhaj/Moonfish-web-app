/**
 * Types du moteur de score Moonfish.
 * Aucun import : ce module doit rester utilisable hors Next.js (test, worker, CLI).
 */

export type ScoreFactor = 'tide' | 'wind' | 'swell' | 'solunar' | 'light';

export type ScoreLabel = 'Médiocre' | 'Passable' | 'Bon' | 'Excellent';

export type SafetyLevel = 'ok' | 'prudence' | 'danger';

export type TideState = 'rising' | 'falling' | 'slack';

export interface TideInput {
  /** Heures signées depuis la pleine mer. Négatif = avant PM, positif = après PM. */
  hoursFromHighTide: number;
  /** Coefficient de marée (échelle SHOM, 20–120). */
  coefficient: number;
  state: TideState;
}

export interface WindInput {
  speedKmh: number;
  /** Direction D'OÙ VIENT le vent, en degrés (convention marine, handoff §5). */
  fromDeg: number;
}

export interface SwellInput {
  /** Hauteur significative en mètres. */
  heightM: number;
  /** Période pic en secondes. */
  periodS: number;
}

export interface SolunarInput {
  /** Écart absolu, en heures, avec la période majeure la plus proche (lune au zénith/nadir). */
  hoursToMajorPeriod: number;
  /** Écart absolu, en heures, avec la période mineure la plus proche (lever/coucher de lune). */
  hoursToMinorPeriod: number;
  /** Illumination du disque lunaire, 0–100. */
  moonIlluminationPct: number;
  /** Âge de la lunaison en jours, 0–29.53. */
  moonAgeDays: number;
}

export type LightPhase = 'dawn' | 'day' | 'dusk' | 'night';

export interface LightInput {
  phase: LightPhase;
}

export interface ScoreInput {
  /**
   * Cap du spot vers le large, en degrés (0 = plage exposée au nord).
   * Sert à qualifier le vent en « de mer » ou « de terre », qui est
   * l'information réellement utile au pêcheur (handoff §5).
   */
  spotFacingDeg: number;
  tide: TideInput;
  wind: WindInput;
  swell: SwellInput;
  solunar: SolunarInput;
  light: LightInput;
}

export interface FactorResult {
  /** Sous-score du facteur, 0–10. */
  score: number;
  /** Poids du facteur dans le total, 0–1. */
  weight: number;
  /** Phrase courte expliquant le sous-score, en français. */
  note: string;
}

export interface ScoreResult {
  /** Score global 0–10, une décimale. */
  value: number;
  label: ScoreLabel;
  /** 2 à 3 phrases lisibles en français. */
  reasons: string[];
  breakdown: Record<ScoreFactor, FactorResult>;
  safety: { level: SafetyLevel; message?: string };
}

export const FACTOR_WEIGHTS: Record<ScoreFactor, number> = {
  tide: 0.35,
  wind: 0.25,
  swell: 0.2,
  solunar: 0.15,
  light: 0.05,
};

export const FACTOR_LABELS: Record<ScoreFactor, string> = {
  tide: 'Marée',
  wind: 'Vent',
  swell: 'Houle',
  solunar: 'Solunaire & lune',
  light: 'Lumière',
};
