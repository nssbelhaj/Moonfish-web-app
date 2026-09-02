import { TideProviderWithFallback, WeatherProviderWithFallback } from './fallback';
import { MockSpotRepository } from './mock/spots';
import { MockTideProvider } from './mock/tide';
import { MockWeatherProvider } from './mock/weather';
import { ClosedContributionsRepository } from './closed/contributions';
import { FileWaitlistRepository } from './mock/waitlist';
import { OpenMeteoWeatherProvider } from './open-meteo/weather';
import { SelectiveTideProvider, parseAllowedSpots } from './selective-tide';
import { StormglassTideProvider } from './stormglass/tide';
import { MysqlContributionsRepository } from './mysql/contributions';
import { MysqlWaitlistRepository } from './mysql/waitlist';
import type {
  ContributionsRepository,
  SpotRepository,
  TideProvider,
  WaitlistRepository,
  WeatherProvider,
} from './types';
import { accountsEnabled } from '@/lib/auth/config';
import { databaseEnabled } from '@/lib/db/mysql';

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
 * Marées, météo, liste d'attente et contributions basculent tous sur détection
 * d'une variable d'environnement : aucune modification de code n'est nécessaire
 * pour passer en réel, et un déploiement sans configuration reste fonctionnel
 * en le DISANT.
 *
 * Reste à brancher :
 *
 *   import { MysqlSpotRepository } from './mysql/spots';
 *   export const spots: SpotRepository = new MysqlSpotRepository();
 *
 * Les spots sont du contenu éditorial écrit à la main : les mettre en base
 * n'apporterait rien tant qu'ils ne sont pas modifiables depuis une interface.
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

  const real = new StormglassTideProvider(apiKey, {
    ...(Number.isFinite(cacheSeconds) && cacheSeconds > 0 ? { cacheSeconds } : {}),
    ...(process.env.STORMGLASS_URL ? { baseUrl: process.env.STORMGLASS_URL } : {}),
  });

  // Un repli enveloppe TOUJOURS le fournisseur réel : une panne réseau ne doit
  // ni casser le build ni rendre douze pages en 500.
  const withFallback = new TideProviderWithFallback(real, mock);

  // `TIDE_REAL_SPOTS` borne la dépense quand le quota est petit. Vide = tous les
  // spots passent par le fournisseur réel, ce qui reste le comportement par
  // défaut.
  const allowed = parseAllowedSpots(process.env.TIDE_REAL_SPOTS);
  if (allowed.length === 0) return withFallback;

  return new SelectiveTideProvider(withFallback, mock, allowed);
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

/**
 * Liste d'attente : MySQL dès que la base est configurée, sinon le fichier
 * local — éphémère, et annoncé comme tel.
 *
 * La bascule ne dépend que de la base, pas de l'envoi de courriel : une
 * inscription à la liste d'attente n'a besoin d'aucun message pour être
 * enregistrée.
 */
export const waitlist: WaitlistRepository = databaseEnabled()
  ? new MysqlWaitlistRepository()
  : new FileWaitlistRepository();

/**
 * Contributions : MySQL, ou l'implémentation FERMÉE.
 *
 * Pas de mode démonstration ici, à la différence de la marée et de la météo.
 * Une marée simulée illustre le fonctionnement du site ; un avis simulé serait
 * un faux témoignage signé d'un faux pêcheur, sur une page qui promet
 * précisément de rapporter ce que de vraies personnes ont déclaré.
 */
export const contributions: ContributionsRepository = accountsEnabled()
  ? new MysqlContributionsRepository()
  : new ClosedContributionsRepository();

/**
 * Le soleil et la Lune ne sont pas un fournisseur : ils sont calculés localement
 * par `src/lib/astro`. Cette source est déclarée ici pour que `DataSourceTag`
 * puisse les distinguer honnêtement des données simulées.
 */
export const ASTRO_SOURCE = {
  name: 'Calcul astronomique local',
  kind: 'computed' as const,
  precision:
    'Soleil : algorithme NOAA. Lune : séries de Meeus (ELP-2000 abrégée), lever, coucher et passages au méridien à la minute. Aucun réseau, aucun cache : recalculé à chaque affichage.',
} as const;

export type {
  AccountExport,
  Author,
  ContributionResult,
  ContributionsRepository,
  SpotContributions,
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
