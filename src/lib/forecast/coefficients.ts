import { tideCoefficientFor } from '@/data/generators/tide';

/**
 * Les coefficients à venir, pour planifier.
 *
 * ─── Ce qu'on peut calculer, et ce qu'on ne peut pas ──────────────────────
 *
 * Le coefficient est une valeur NATIONALE rapportée à Brest : il ne dépend
 * pas du spot, seulement de la date. Il suit la lunaison, avec le retard de
 * deux jours des vives-eaux sur la syzygie — un fait d'observation, pas un
 * ajustement cosmétique. On peut donc le calculer pour n'importe quelle date,
 * sans réseau, sans quota, sans clé.
 *
 * Ce n'est PAS la table du SHOM. L'écart est de quelques points, sans
 * conséquence pour ce à quoi cette frise sert — savoir quand tombent les
 * prochaines vives-eaux — mais il existe, et la page le dit. Pour une heure
 * de marée, c'est le SHOM qui fait foi, et la page le dit aussi.
 */

/** Seuil des vives-eaux. Au-dessus, le marnage et les courants changent d'échelle. */
export const VIVES_EAUX = 95;
/** Seuil des mortes-eaux. En dessous, l'eau bouge peu et les postes se ferment. */
export const MORTES_EAUX = 45;

export type RegimeMaree = 'vives-eaux' | 'moyen' | 'mortes-eaux';

export interface JourCoefficient {
  /** Minuit UTC du jour, ISO. */
  date: string;
  coefficient: number;
  regime: RegimeMaree;
  /** Vrai si le coefficient est un maximum local : le pic d'une vive-eau. */
  pic: boolean;
}

export function regimeDe(coefficient: number): RegimeMaree {
  if (coefficient >= VIVES_EAUX) return 'vives-eaux';
  if (coefficient <= MORTES_EAUX) return 'mortes-eaux';
  return 'moyen';
}

/**
 * Les `jours` prochains coefficients, à partir de minuit du jour de `depuis`.
 *
 * Les pics sont marqués : ce sont les dates qu'on note dans un calendrier, et
 * les repérer d'un coup d'œil est tout l'intérêt de la frise.
 */
export function prochainsCoefficients(depuis: Date, jours = 30): JourCoefficient[] {
  const debut = Date.UTC(depuis.getUTCFullYear(), depuis.getUTCMonth(), depuis.getUTCDate());

  const bruts = Array.from({ length: jours }, (_, index) => {
    const date = new Date(debut + index * 86_400_000);
    const coefficient = tideCoefficientFor(date);
    return { date: date.toISOString(), coefficient, regime: regimeDe(coefficient) };
  });

  return bruts.map((jour, index) => ({
    ...jour,
    // Un pic est un maximum LOCAL au-dessus du seuil de vives-eaux. Les bords
    // de la frise n'en sont jamais : on ne sait pas ce qu'il y a juste avant
    // ni juste après, et l'affirmer serait deviner.
    pic:
      jour.coefficient >= VIVES_EAUX &&
      index > 0 &&
      index < bruts.length - 1 &&
      jour.coefficient >= (bruts[index - 1]?.coefficient ?? 0) &&
      jour.coefficient >= (bruts[index + 1]?.coefficient ?? 0),
  }));
}
