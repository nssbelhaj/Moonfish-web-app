import { clamp, fr, round1, trapezoid } from '../math';
import type { AvailableFactorResult, FactorResult, WaterInput } from '../types';
import { FACTOR_WEIGHTS, unavailableFactor } from '../types';

/**
 * Température de l'eau.
 *
 * ─── Ce qu'elle explique, et ce qu'elle n'explique pas ────────────────────
 *
 * Le métabolisme d'un poisson suit celui de l'eau : trop froide, il ralentit
 * et se nourrit peu ; trop chaude, l'oxygène dissous chute et il descend ou
 * devient nocturne. C'est l'un des rares points sur lesquels la pratique et
 * la littérature halieutique s'accordent sans réserve.
 *
 * Ce qu'elle n'explique PAS, et qu'il serait malhonnête de laisser croire :
 * elle ne discrimine pas deux créneaux de la même journée. L'eau bouge de
 * quelques dixièmes par jour, là où la marée change tout en deux heures.
 * Elle départage des SAISONS et des spots, pas des créneaux — d'où un poids
 * de 7 %, le second plus faible du modèle.
 *
 * ─── Pourquoi un plateau si large ─────────────────────────────────────────
 *
 * Le catalogue va de la Bretagne à Dakhla. Une courbe calée sur le bar
 * breton mettrait Agadir en défaut toute l'année, alors qu'on y pêche très
 * bien à 22 °C. Le plateau couvre donc 11 à 22 °C, et les épaules sont
 * douces. Le facteur ne descend jamais sous 4,5/10 : il nuance, il ne
 * condamne pas. Prétendre mieux demanderait un optimum PAR ESPÈCE et une
 * climatologie locale — deux choses que nous n'avons pas, et qu'il vaut
 * mieux admettre que simuler.
 */

/** En deçà, le métabolisme est nettement ralenti pour les espèces du catalogue. */
export const FROID_VIF_C = 9;
/** Au-delà, l'oxygène dissous devient limitant sur la frange côtière. */
export const CHAUD_LIMITANT_C = 24;

/**
 * Facteur de température, 0,45–1.
 *
 * Trapèze : montée de 6 à 11 °C, plateau jusqu'à 22, descente jusqu'à 27. Le
 * plancher à 0,45 est délibéré — une eau à 5 °C rend la pêche difficile, elle
 * ne l'annule pas, et des pêcheurs prennent du bar en plein hiver.
 */
export function waterFactor(celsius: number): number {
  return clamp(0.45 + 0.55 * trapezoid(celsius, 6, 11, 22, 27), 0.45, 1);
}

/** Qualification en clair, pour la phrase d'explication. */
export function describeWater(celsius: number): string {
  if (celsius < 6) return 'très froide';
  if (celsius < FROID_VIF_C) return 'froide';
  if (celsius < 11) return 'fraîche';
  if (celsius <= 22) return 'dans la plage active';
  if (celsius <= CHAUD_LIMITANT_C) return 'chaude';
  return 'très chaude';
}

export function scoreWater(input: WaterInput): AvailableFactorResult;
export function scoreWater(input: WaterInput | null): FactorResult;
export function scoreWater(input: WaterInput | null): FactorResult {
  if (input === null) return unavailableFactor('water');

  const c = input.celsius;
  const label = describeWater(c);
  const valeur = `${fr(c)} °C`;

  const note =
    c < FROID_VIF_C
      ? `${valeur}, ${label} — métabolisme ralenti, touches plus rares et plus discrètes`
      : c < 11
        ? `${valeur}, ${label} — l’activité reprend, souvent aux heures les plus douces`
        : c <= 22
          ? `${valeur}, ${label}`
          : c <= CHAUD_LIMITANT_C
            ? `${valeur}, ${label} — le poisson cherche le frais, mieux vaut tôt ou tard`
            : `${valeur}, ${label} — oxygène en baisse, activité repoussée vers la nuit`;

  return {
    score: round1(clamp(10 * waterFactor(c), 0, 10)),
    weight: FACTOR_WEIGHTS.water,
    nominalWeight: FACTOR_WEIGHTS.water,
    note,
  };
}
