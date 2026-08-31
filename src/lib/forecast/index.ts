import type { Spot, TideEvent } from '@/data/schemas';
import { ASTRO_SOURCE, spots as spotRepository, tides, weather, type SourceMeta } from '@/lib/providers';
import { addHours, startOfLocalDay } from '@/lib/time';
import {
  bestSlot,
  buildForecastDays,
  currentSlot,
  nextGoodWindow,
  FORECAST_DAYS,
  type ForecastDay,
  type ForecastSlot,
} from './slots';

export * from './slots';
export { tideContextAt, nextHighTide, tideEventsBetween } from './tide-context';

/**
 * Instant de référence, arrondi à l'heure.
 *
 * Deux builds lancés dans la même heure produisent des pages strictement
 * identiques : sans cet arrondi, le créneau « en cours » se décalerait à chaque
 * build et le diff des pages statiques deviendrait illisible.
 */
export function referenceNow(): Date {
  return new Date(Math.floor(Date.now() / 3_600_000) * 3_600_000);
}

export interface ForecastSources {
  tide: SourceMeta;
  weather: SourceMeta;
  astro: SourceMeta;
}

export interface SpotForecast {
  spot: Spot;
  /** Instant de calcul, ISO. */
  generatedAt: string;
  days: ForecastDay[];
  tideEvents: TideEvent[];
  /** Créneau en cours, ou le premier à venir. */
  current: ForecastSlot | null;
  /** Meilleur créneau des 7 jours, hors conditions dangereuses. */
  best: ForecastSlot | null;
  /** Prochaine fenêtre au moins « Bonne ». */
  nextGood: ForecastSlot | null;
  sources: ForecastSources;
}

/**
 * Prévision complète d'un spot.
 *
 * Elle ne touche que des interfaces (`tides`, `weather`), jamais les mocks.
 * Le jour du branchement, cette fonction ne change pas.
 */
export async function getSpotForecast(spot: Spot, now: Date = referenceNow()): Promise<SpotForecast> {
  const start = startOfLocalDay(now, spot.timezone);
  // Marge de 8 h de part et d'autre : chaque instant doit avoir une pleine mer
  // avant et après lui, sinon le contexte de marée serait tronqué aux bords.
  const range = { from: addHours(start, -8), to: addHours(start, FORECAST_DAYS * 24 + 8) };

  const [tideResult, weatherResult] = await Promise.all([
    tides.getTideEvents(spot, range),
    weather.getMarineSeries(spot, range),
  ]);

  const days = buildForecastDays(spot, now, tideResult.data, weatherResult.data);

  return {
    spot,
    generatedAt: now.toISOString(),
    days,
    tideEvents: tideResult.data,
    current: currentSlot(days, now),
    best: bestSlot(days.flatMap((day) => day.slots)),
    nextGood: nextGoodWindow(days, now),
    sources: {
      tide: tideResult.source,
      weather: weatherResult.source,
      astro: ASTRO_SOURCE,
    },
  };
}

/** Vue compacte d'un spot, telle qu'affichée sur une carte de liste. */
export interface SpotSummary {
  spot: Spot;
  current: ForecastSlot | null;
  nextGood: ForecastSlot | null;
  best: ForecastSlot | null;
}

export async function getSpotSummary(spot: Spot, now: Date = referenceNow()): Promise<SpotSummary> {
  const forecast = await getSpotForecast(spot, now);
  return {
    spot,
    current: forecast.current,
    nextGood: forecast.nextGood,
    best: forecast.best,
  };
}

/** Résumés de tous les spots, triés du meilleur score courant au moins bon. */
export async function getAllSpotSummaries(now: Date = referenceNow()): Promise<SpotSummary[]> {
  const all = await spotRepository.list();
  const summaries = await Promise.all(all.map((spot) => getSpotSummary(spot, now)));
  return summaries.sort((a, b) => (b.current?.score.value ?? 0) - (a.current?.score.value ?? 0));
}
