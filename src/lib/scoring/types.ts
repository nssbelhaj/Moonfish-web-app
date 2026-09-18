/**
 * Types du moteur de score Luna Marea.
 * Aucun import : ce module doit rester utilisable hors Next.js (test, worker, CLI).
 */

export type ScoreFactor =
  | 'tide'
  | 'wind'
  | 'swell'
  | 'solunar'
  | 'pressure'
  | 'water'
  | 'light';

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

export interface PressureInput {
  /** Pression au niveau de la mer, en hPa. */
  hPa: number;
  /**
   * Variation sur les trois dernières heures, en hPa. Négatif = en baisse.
   * `null` quand la série ne remonte pas assez loin : on ne devine pas une
   * tendance, on neutralise le facteur.
   */
  trend3hHpa: number | null;
}

export interface WaterInput {
  /** Température de surface de la mer, en degrés Celsius. */
  celsius: number;
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
  pressure: PressureInput | null;
  water: WaterInput | null;
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

/**
 * Poids nominaux. Leur somme fait 1.
 *
 * La pression est entrée dans le modèle à 9 %, prise sur les quatre autres au
 * prorata. C'est un facteur RÉEL — la tendance barométrique est l'un des rares
 * points sur lesquels la pratique et la littérature s'accordent — mais
 * secondaire devant la marée. Lui donner davantage prétendrait une précision
 * que ni la donnée horaire ni la littérature ne soutiennent.
 *
 * ─── La température de l'eau, entrée à 7 % ────────────────────────────────
 *
 * Elle était déjà mesurée et AFFICHÉE, sans entrer dans le calcul : le site
 * montrait « Eau 14,2 °C » à côté d'un score qui l'ignorait. Elle compte
 * pourtant — le métabolisme d'un poisson suit celui de l'eau.
 *
 * Elle reste secondaire pour une raison de forme, pas d'importance : l'eau
 * bouge de quelques dixièmes par jour, là où la marée change tout en deux
 * heures. Elle départage des SAISONS et des spots, pas deux créneaux du même
 * après-midi. Lui donner le poids de la marée reviendrait à décaler toute
 * une journée d'un bloc, ce qui n'aiderait personne à choisir son heure.
 *
 * Les 7 % sont pris sur les six autres au prorata, comme pour la pression :
 * l'équilibre relatif entre marée, vent, houle, solunaire, pression et
 * lumière est INCHANGÉ.
 */
export const FACTOR_WEIGHTS: Record<ScoreFactor, number> = {
  tide: 0.3,
  wind: 0.21,
  swell: 0.17,
  solunar: 0.12,
  pressure: 0.08,
  water: 0.07,
  light: 0.05,
};

export const FACTOR_LABELS: Record<ScoreFactor, string> = {
  tide: 'Marée',
  wind: 'Vent',
  swell: 'Houle',
  solunar: 'Solunaire & lune',
  pressure: 'Pression',
  water: 'Température de l’eau',
  light: 'Lumière',
};

/** Sujet de la phrase « Calculé sans … », au féminin ou masculin correct. */
export const FACTOR_SUBJECTS: Record<ScoreFactor, string> = {
  tide: 'la marée',
  wind: 'le vent',
  swell: 'la houle',
  solunar: 'le solunaire',
  pressure: 'la pression',
  water: 'la température de l’eau',
  light: 'la lumière',
};

/**
 * Combien de facteurs, en toutes lettres — et la phrase qui les énumère.
 *
 * ─── Pourquoi ce n'est pas une constante de texte ─────────────────────────
 *
 * La page d'accueil et sa FAQ annonçaient « Cinq facteurs pondérés : la marée
 * pour 35 %, le vent pour 25 %… ». Le moteur en comptait six depuis l'arrivée
 * de la pression, sept depuis celle de l'eau, et aucun de ces pourcentages
 * n'était plus celui qui servait au calcul. Rien ne pouvait le signaler : une
 * phrase en dur est cohérente avec elle-même, pour toujours.
 *
 * Un site dont la promesse est d'expliquer son calcul ne peut pas se tromper
 * sur son propre calcul. Le texte est donc DÉRIVÉ des poids, ici, une seule
 * fois.
 */
const NOMBRES_EN_LETTRES: Record<number, string> = {
  3: 'Trois',
  4: 'Quatre',
  5: 'Cinq',
  6: 'Six',
  7: 'Sept',
  8: 'Huit',
  9: 'Neuf',
  10: 'Dix',
};

/** Les facteurs du plus lourd au plus léger. L'ordre du texte suit l'importance. */
export const FACTORS_BY_WEIGHT: readonly ScoreFactor[] = (
  Object.keys(FACTOR_WEIGHTS) as ScoreFactor[]
).sort((a, b) => FACTOR_WEIGHTS[b] - FACTOR_WEIGHTS[a]);

/** « Sept », capitalisé, pour ouvrir une phrase. Le chiffre si le mot manque. */
export const FACTOR_COUNT_WORD: string =
  NOMBRES_EN_LETTRES[FACTORS_BY_WEIGHT.length] ?? String(FACTORS_BY_WEIGHT.length);

/** « la marée pour 30 %, le vent pour 21 %, …, et la lumière pour 5 % ». */
export function factorWeightSentence(): string {
  const parts = FACTORS_BY_WEIGHT.map(
    (factor) => `${FACTOR_SUBJECTS[factor]} pour ${Math.round(FACTOR_WEIGHTS[factor] * 100)} %`,
  );
  const last = parts.pop();
  return last === undefined ? '' : parts.length === 0 ? last : `${parts.join(', ')} et ${last}`;
}

/** Note affichée dans le détail quand la source du facteur manque. */
export const FACTOR_UNAVAILABLE_NOTES: Record<ScoreFactor, string> = {
  tide: 'horaires de marée indisponibles pour ce créneau',
  wind: 'vent indisponible pour ce créneau',
  swell: 'houle indisponible pour ce créneau',
  solunar: 'éphémérides lunaires indisponibles pour ce créneau',
  pressure: 'pression indisponible pour ce créneau',
  water: 'température de l’eau indisponible pour ce créneau',
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
