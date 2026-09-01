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

/**
 * Entrée du score.
 *
 * Chaque facteur peut être `null` : une source indisponible n'est pas une
 * source à zéro. Le score est alors calculé sur les facteurs restants, poids
 * renormalisés, et le dit explicitement (D11). Substituer une valeur par
 * défaut produirait un score faux qui se présenterait comme un score normal.
 */
export interface ScoreInput {
  /**
   * Cap du spot vers le large, en degrés (0 = plage exposée au nord).
   * Sert à qualifier le vent en « de mer » ou « de terre », qui est
   * l'information réellement utile au pêcheur.
   */
  spotFacingDeg: number;
  tide: TideInput | null;
  wind: WindInput | null;
  swell: SwellInput | null;
  solunar: SolunarInput | null;
  light: LightInput | null;
}

export interface FactorResult {
  /** Sous-score du facteur, 0–10. `null` si la source est indisponible. */
  score: number | null;
  /**
   * Poids EFFECTIF dans le total après renormalisation, 0–1.
   * Vaut 0 quand le facteur est indisponible.
   */
  weight: number;
  /** Poids nominal du facteur, indépendant de ce qui est disponible. */
  nominalWeight: number;
  /** Phrase courte expliquant le sous-score, en français. */
  note: string;
}

/**
 * Résultat d'un facteur dont la source ÉTAIT disponible.
 *
 * Sert de type de retour aux surcharges des scoreurs appelés avec une entrée
 * non nulle : le code qui sait déjà que la donnée existe n'a pas à traiter un
 * `null` que le typage seul rendrait obligatoire.
 */
export interface AvailableFactorResult extends FactorResult {
  score: number;
}

export interface ScoreResult {
  /** Score global 0–10, une décimale. `null` si aucun facteur n'est disponible. */
  value: number | null;
  label: ScoreLabel | null;
  /**
   * Part du poids nominal réellement couverte par les sources disponibles, 0–1.
   * 1 = tous les facteurs présents. Sert à qualifier la confiance sans avoir à
   * recalculer la somme des poids côté interface.
   */
  coverage: number;
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

/** Sujet de la phrase « Calculé sans … », au féminin ou masculin correct. */
export const FACTOR_SUBJECTS: Record<ScoreFactor, string> = {
  tide: 'la marée',
  wind: 'le vent',
  swell: 'la houle',
  solunar: 'le solunaire',
  light: 'la lumière',
};

/** Note affichée dans le détail quand la source du facteur manque. */
export const FACTOR_UNAVAILABLE_NOTES: Record<ScoreFactor, string> = {
  tide: 'horaires de marée indisponibles pour ce créneau',
  wind: 'vent indisponible pour ce créneau',
  swell: 'houle indisponible pour ce créneau',
  solunar: 'éphémérides lunaires indisponibles pour ce créneau',
  light: 'lever et coucher du soleil indisponibles pour ce créneau',
};

/**
 * Facteur dont la source manque.
 *
 * `score: null` et non 0 : un zéro se comporterait comme une mauvaise note et
 * ferait chuter le total, ce qui reviendrait à affirmer une condition qu'on
 * n'a pas mesurée. Le poids effectif est mis à 0 ; `computeScore` renormalise
 * ensuite les autres facteurs pour que le total reste sur 10.
 */
export function unavailableFactor(factor: ScoreFactor): FactorResult {
  return {
    score: null,
    weight: 0,
    nominalWeight: FACTOR_WEIGHTS[factor],
    note: FACTOR_UNAVAILABLE_NOTES[factor],
  };
}
