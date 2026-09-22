import type { Spot } from '@/data/schemas';
import type { PaysCatalogue } from '@/data/spots';
import type { SpotForecast } from './index';
import { momentsFor, type Moment } from './moments';
import { localDateKey } from '@/lib/time';

/**
 * Ce qu'une page — l'accueil ou une page pays — a besoin de savoir d'un pays
 * pour le montrer EN DIRECT : le meilleur spot maintenant, les deux moments
 * à venir, la semaine du meilleur spot, et quels spots ont des marées réelles.
 *
 * Tout est dérivé des prévisions déjà calculées : cette fonction ne touche ni
 * réseau ni fournisseur, elle ne fait que choisir.
 */

export interface JourDeSemaine {
  /** Minuit local du jour, ISO — la clé d'ancre de la page de prévision. */
  date: string;
  /** Meilleur score du jour, hors créneaux dangereux. `null` si aucun n'est calculable. */
  meilleur: number | null;
  /** Vrai si le jour ne contient QUE des créneaux dangereux ou sans score. */
  danger: boolean;
}

export interface ResumePays {
  pays: PaysCatalogue;
  /** Le meilleur spot en ce moment, hors danger. `null` si aucun score n'est calculable. */
  meilleur: SpotForecast | null;
  moments: Moment[];
  /** Les jours de prévision du meilleur spot, un score par jour. */
  semaine: JourDeSemaine[];
  /** Les spots du pays dont la marée vient d'un fournisseur réel, et les autres. */
  marees: { reelles: Spot[]; simulees: Spot[] };
}

/** Un score par jour, le meilleur des créneaux praticables. */
export function semaineDe(forecast: SpotForecast): JourDeSemaine[] {
  return forecast.days.map((day) => {
    let meilleur: number | null = null;
    let unDanger = false;

    for (const slot of day.slots) {
      if (slot.score.value === null) continue;
      if (slot.score.safety.level === 'danger') {
        unDanger = true;
        continue;
      }
      if (meilleur === null || slot.score.value > meilleur) meilleur = slot.score.value;
    }

    return { date: day.date, meilleur, danger: meilleur === null && unDanger };
  });
}

export function resumePays(
  pays: PaysCatalogue,
  forecasts: readonly SpotForecast[],
  maintenant: Date,
): ResumePays {
  const slugs = new Set(pays.spots.map((spot) => spot.slug));
  const duPays = forecasts.filter((forecast) => slugs.has(forecast.spot.slug));

  /*
    Le meilleur MAINTENANT, et pas le meilleur des sept jours : c'est la
    question de la page d'accueil. Un spot en danger n'est jamais « le
    meilleur », quel que soit son score — la règle de sécurité ne se dérive
    d'aucun score, elle le précède.
  */
  const meilleur =
    duPays
      .filter(
        (forecast) =>
          forecast.current !== null &&
          forecast.current.score.value !== null &&
          forecast.current.score.safety.level !== 'danger',
      )
      .sort(
        (a, b) => (b.current?.score.value ?? 0) - (a.current?.score.value ?? 0),
      )[0] ?? null;

  const reelles: Spot[] = [];
  const simulees: Spot[] = [];
  for (const forecast of duPays) {
    (forecast.sources.tide.source.kind === 'simulated' ? simulees : reelles).push(forecast.spot);
  }

  return {
    pays,
    meilleur,
    moments: momentsFor(duPays, maintenant),
    semaine: meilleur ? semaineDe(meilleur) : [],
    marees: { reelles, simulees },
  };
}

/** Ancre d'un jour sur la page de prévision d'un spot. */
export function ancreDuJour(dateIso: string, timeZone: string): string {
  return `jour-${localDateKey(new Date(dateIso), timeZone)}`;
}
