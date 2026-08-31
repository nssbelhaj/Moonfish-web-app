import { MockSpotRepository } from './mock/spots';
import { MockTideProvider } from './mock/tide';
import { MockWeatherProvider } from './mock/weather';
import { FileWaitlistRepository } from './mock/waitlist';
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
 * Exemple de bascule complète :
 *
 *   import { StormglassTideProvider } from './stormglass/tide';
 *   import { OpenMeteoWeatherProvider } from './open-meteo/weather';
 *   import { SupabaseSpotRepository } from './supabase/spots';
 *   import { SupabaseWaitlistRepository } from './supabase/waitlist';
 *
 *   export const tides: TideProvider = new StormglassTideProvider(process.env.STORMGLASS_KEY!);
 *   export const weather: WeatherProvider = new OpenMeteoWeatherProvider();
 *   export const spots: SpotRepository = new SupabaseSpotRepository();
 *   export const waitlist: WaitlistRepository = new SupabaseWaitlistRepository();
 */

export const tides: TideProvider = new MockTideProvider();
export const weather: WeatherProvider = new MockWeatherProvider();
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
