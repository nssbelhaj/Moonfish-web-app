import { cache } from 'react';
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
async function computeSpotForecast(spot: Spot, now: Date): Promise<SpotForecast> {
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

/**
 * Mémoïsation pour la durée d'une requête, clefée sur des PRIMITIVES.
 *
 * `cache` de React compare ses arguments par référence. Lui passer directement
 * `(spot, now)` ne mémoïserait rien : `referenceNow()` rend un nouvel objet
 * `Date` à chaque appel, donc chaque appel manquerait le cache sans que rien ne
 * le signale. Le slug et l'horodatage en millisecondes, eux, se comparent par
 * valeur.
 */
const forecastCache = cache(async (slug: string, nowMs: number): Promise<SpotForecast> => {
  const spot = await spotRepository.findBySlug(slug);
  if (!spot) throw new Error(`Spot inconnu : ${slug}`);
  return computeSpotForecast(spot, new Date(nowMs));
});

/**
 * Prévision complète d'un spot.
 *
 * Depuis le passage en onglets, le layout du spot et la page active en ont tous
 * deux besoin — le layout pour le bandeau de sécurité et l'avertissement de
 * source, la page pour son contenu. Sans mémoïsation, chaque rendu déclencherait
 * deux fois l'assemblage complet et, avec un fournisseur réel, deux fois les
 * appels réseau. Ce cache ne vit que le temps d'une requête : il ne remplace pas
 * celui des `fetch`, il évite le travail redondant à l'intérieur d'un rendu.
 */
export function getSpotForecast(spot: Spot, now: Date = referenceNow()): Promise<SpotForecast> {
  return forecastCache(spot.slug, now.getTime());
}

/** Vue compacte d'un spot, telle qu'affichée sur une carte de liste. */
export interface SpotSummary {
  spot: Spot;
  current: ForecastSlot | null;
  nextGood: ForecastSlot | null;
  best: ForecastSlot | null;
  /**
   * Sources RÉELLEMENT utilisées pour ce spot, pas celles déclarées par les
   * fournisseurs : si Open-Meteo est tombé sur ce spot précis, c'est ici qu'on
   * le voit, et c'est ce qui rallume l'avertissement de démonstration.
   */
  sources: ForecastSources;
}

export async function getSpotSummary(spot: Spot, now: Date = referenceNow()): Promise<SpotSummary> {
  const forecast = await getSpotForecast(spot, now);
  return {
    spot,
    current: forecast.current,
    nextGood: forecast.nextGood,
    best: forecast.best,
    sources: forecast.sources,
  };
}

/** Aplatit les sources d'un lot de spots, sans doublon, pour l'avertissement de page. */
export function collectSources(summaries: readonly SpotSummary[]): SourceMeta[] {
  const seen = new Map<string, SourceMeta>();
  for (const summary of summaries) {
    for (const source of Object.values(summary.sources)) {
      if (!seen.has(source.name)) seen.set(source.name, source);
    }
  }
  return [...seen.values()];
}

/** Résumés de tous les spots, triés du meilleur score courant au moins bon. */
export async function getAllSpotSummaries(now: Date = referenceNow()): Promise<SpotSummary[]> {
  const all = await spotRepository.list();
  const summaries = await Promise.all(all.map((spot) => getSpotSummary(spot, now)));
  return summaries.sort((a, b) => (b.current?.score.value ?? 0) - (a.current?.score.value ?? 0));
}
