import { TideProviderWithFallback, WeatherProviderWithFallback } from './fallback';
import { MockSpotRepository } from './mock/spots';
import { MockTideProvider } from './mock/tide';
import { MockWeatherProvider } from './mock/weather';
import { FileWaitlistRepository } from './mock/waitlist';
import { OpenMeteoWeatherProvider } from './open-meteo/weather';
import { StormglassTideProvider } from './stormglass/tide';
import type { SpotRepository, TideProvider, WaitlistRepository, WeatherProvider } from './types';

/**
 * ═══════════════════════════════════════════════════════════════════════
 *  LE POINT DE BASCULE
 * ═══════════════════════════════════════════════════════════════════════
 *
 * C'est le SEUL fichier à modifier pour passer des mocks aux vraies données.
 * Quatre lignes, quatre fournisseurs. Aucune page, aucun composant, aucun
 * module de scoring n'importe une implémentation directement : tous passent
 * par les interfaces exportées ici.
 *
 * Reste à brancher :
 *
 *   import { SupabaseSpotRepository } from './supabase/spots';
 *   import { SupabaseWaitlistRepository } from './supabase/waitlist';
 *
 *   export const spots: SpotRepository = new SupabaseSpotRepository();
 *   export const waitlist: WaitlistRepository = new SupabaseWaitlistRepository();
 */

/**
 * Marées : Stormglass dès qu'une clé est présente, sinon le modèle de
 * démonstration — clairement étiqueté comme tel sur chaque page.
 *
 * La clé n'est pas fournie par défaut, et c'est volontaire : mieux vaut un site
 * qui annonce des marées simulées qu'un site qui échoue à se construire faute
 * d'une variable d'environnement.
 */
function buildTideProvider(): TideProvider {
  const mock = new MockTideProvider();
  const apiKey = process.env.STORMGLASS_API_KEY?.trim();

  if (!apiKey || process.env.TIDE_PROVIDER === 'mock') return mock;

  const cacheSeconds = Number(process.env.TIDE_CACHE_SECONDS);

  return new TideProviderWithFallback(
    new StormglassTideProvider(apiKey, {
      ...(Number.isFinite(cacheSeconds) && cacheSeconds > 0 ? { cacheSeconds } : {}),
      ...(process.env.STORMGLASS_URL ? { baseUrl: process.env.STORMGLASS_URL } : {}),
    }),
    mock,
  );
}

export const tides: TideProvider = buildTideProvider();

/**
 * Météo marine : Open-Meteo est branché.
 *
 * `WEATHER_PROVIDER=mock` force les données simulées — utile pour les tests,
 * une démonstration hors ligne, ou un build sans accès réseau sortant.
 * Toute autre valeur, y compris l'absence de variable, utilise Open-Meteo avec
 * repli explicite sur le mock en cas de panne.
 */
export const weather: WeatherProvider =
  process.env.WEATHER_PROVIDER === 'mock'
    ? new MockWeatherProvider()
    : new WeatherProviderWithFallback(
        new OpenMeteoWeatherProvider({
          // Redirigeables vers une instance Open-Meteo auto-hébergée, ou vers un
          // serveur local pour une démonstration hors ligne. Absents, les points
          // d'accès publics sont utilisés.
          ...(process.env.OPEN_METEO_MARINE_URL
            ? { marineUrl: process.env.OPEN_METEO_MARINE_URL }
            : {}),
          ...(process.env.OPEN_METEO_FORECAST_URL
            ? { forecastUrl: process.env.OPEN_METEO_FORECAST_URL }
            : {}),
        }),
        new MockWeatherProvider(),
      );

export const spots: SpotRepository = new MockSpotRepository();
export const waitlist: WaitlistRepository = new FileWaitlistRepository();

/**
 * Le soleil et la Lune ne sont pas un fournisseur : ils sont calculés localement
 * par `src/lib/astro`. Cette source est déclarée ici pour que `DataSourceTag`
 * puisse les distinguer honnêtement des données simulées.
 */
export const ASTRO_SOURCE = {
  name: 'Calcul astronomique local',
  kind: 'computed' as const,
  precision:
    'Lever et coucher du Soleil selon l’algorithme NOAA, précision de l’ordre de la minute. Périodes solunaires approchées à ±20 min.',
} as const;

export type {
  DateRange,
  DataKind,
  SourceMeta,
  Sourced,
  SpotRepository,
  TideProvider,
  WaitlistRepository,
  WaitlistResult,
  WeatherProvider,
} from './types';
