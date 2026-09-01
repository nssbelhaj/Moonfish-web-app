import { marinePointSchema, type MarinePoint, type Spot } from '@/data/schemas';
import type { DateRange, SourceMeta, Sourced, WeatherProvider } from '../types';
import {
  openMeteoErrorSchema,
  openMeteoForecastSchema,
  openMeteoMarineSchema,
} from './schemas';

const MARINE_URL = 'https://marine-api.open-meteo.com/v1/marine';
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';

/** Open-Meteo plafonne le modèle de vagues à 8 jours. On aligne les deux appels dessus. */
const FORECAST_DAYS = 8;

export interface OpenMeteoOptions {
  /** Injectable pour les tests et pour pointer un serveur local. */
  fetchImpl?: typeof fetch;
  marineUrl?: string;
  forecastUrl?: string;
  /** Durée de mise en cache par Next, en secondes. */
  revalidateSeconds?: number;
  /** Délai maximal d'un appel, en millisecondes. */
  timeoutMs?: number;
}

/**
 * Délai maximal par appel.
 *
 * `fetch` sans signal attend indéfiniment. Au build, un fournisseur qui ne
 * répond pas — sans refuser la connexion — bloque la génération des pages
 * jusqu'à ce que la plateforme tue le processus : le build échoue sans qu'aucune
 * erreur ne désigne la cause. Huit secondes laissent largement le temps à une
 * réponse normale (~300 ms) et transforment une panne muette en repli propre.
 */
const DEFAULT_TIMEOUT_MS = 8000;

export class OpenMeteoError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'OpenMeteoError';
  }
}

/** Arrondi à `decimals` décimales, en préservant `null`. */
function round(value: number | null | undefined, decimals: number): number | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * Champ d'AFFICHAGE : hors bornes physiques, on renvoie `null`.
 *
 * Un modèle météo produit occasionnellement une valeur aberrante. Laisser
 * l'erreur remonter ferait basculer TOUT le spot sur les données simulées à
 * cause d'une seule rafale douteuse — on perdrait des heures parfaitement
 * bonnes pour une case d'affichage. « Indispo. » sur ce champ est la réponse
 * proportionnée ; l'interface sait déjà l'afficher.
 */
function bounded(
  value: number | null | undefined,
  decimals: number,
  min: number,
  max: number,
): number | null {
  const rounded = round(value, decimals);
  if (rounded === null) return null;
  return rounded >= min && rounded <= max ? rounded : null;
}

/** Champ CRITIQUE : hors bornes, l'heure entière est écartée. */
function critical(value: number | null | undefined, decimals: number, min: number, max: number): number | null {
  return bounded(value, decimals, min, max);
}

/**
 * Conditions marines réelles, Open-Meteo.
 *
 * Deux appels sont nécessaires et c'est structurel : le modèle de vagues et le
 * modèle atmosphérique sont deux produits distincts, servis par deux hôtes.
 * Ils sont lancés en parallèle puis fusionnés sur l'horodatage — et non sur
 * l'indice, car rien ne garantit que les deux séries commencent à la même heure.
 *
 * `cell_selection=sea` demande la maille marine la plus proche plutôt que la
 * maille la plus proche tout court : sur un spot de bord, la maille terrestre
 * donnerait un vent freiné par le relief, sans rapport avec ce qu'on subit sur
 * l'estran.
 */
export class OpenMeteoWeatherProvider implements WeatherProvider {
  readonly source: SourceMeta = {
    name: 'Open-Meteo — modèles Marine & Forecast',
    kind: 'forecast',
    precision:
      'Sortie de modèle à maille d’environ 5 km, réactualisée toutes les heures. Fiable à 48 h, indicative au-delà : au-delà de J+3, lisez la tendance, pas la valeur.',
    url: 'https://open-meteo.com',
  };

  private readonly options: Required<Omit<OpenMeteoOptions, 'fetchImpl'>> & {
    fetchImpl: typeof fetch;
  };

  constructor(options: OpenMeteoOptions = {}) {
    this.options = {
      fetchImpl: options.fetchImpl ?? fetch,
      marineUrl: options.marineUrl ?? MARINE_URL,
      forecastUrl: options.forecastUrl ?? FORECAST_URL,
      revalidateSeconds: options.revalidateSeconds ?? 3600,
      timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    };
  }

  async getMarineSeries(spot: Spot, range: DateRange): Promise<Sourced<MarinePoint[]>> {
    const [marine, forecast] = await Promise.all([
      this.fetchMarine(spot),
      this.fetchForecast(spot),
    ]);

    // Fusion sur l'horodatage. Une heure présente d'un seul côté est écartée :
    // un score calculé sur un vent sans houle, ou l'inverse, serait faux sans
    // que rien ne le signale.
    const windByTime = new Map<number, { speed: number | null; direction: number | null; gust: number | null; temp: number | null; cloud: number | null; pressure: number | null }>();

    forecast.hourly.time.forEach((epoch, index) => {
      windByTime.set(epoch, {
        speed: forecast.hourly.wind_speed_10m[index] ?? null,
        direction: forecast.hourly.wind_direction_10m[index] ?? null,
        gust: forecast.hourly.wind_gusts_10m?.[index] ?? null,
        temp: forecast.hourly.temperature_2m?.[index] ?? null,
        cloud: forecast.hourly.cloud_cover?.[index] ?? null,
        pressure: forecast.hourly.pressure_msl?.[index] ?? null,
      });
    });

    const points: MarinePoint[] = [];

    marine.hourly.time.forEach((epoch, index) => {
      const timeMs = epoch * 1000;
      if (timeMs < range.from.getTime() || timeMs >= range.to.getTime()) return;

      const wind = windByTime.get(epoch);
      if (!wind) return;

      // Les cinq grandeurs dont dépend le score sont obligatoires et bornées.
      // Sans l'une d'elles, l'heure est écartée — jamais comblée.
      const swellHeightM = critical(marine.hourly.wave_height[index], 2, 0, 30);
      const swellPeriodS = critical(marine.hourly.wave_period[index], 1, 0, 30);
      const swellFromDeg = critical(marine.hourly.wave_direction[index], 0, 0, 360);
      const windSpeedKmh = critical(wind.speed, 1, 0, 400);
      const windFromDeg = critical(wind.direction, 0, 0, 360);

      if (
        swellHeightM === null ||
        swellPeriodS === null ||
        swellFromDeg === null ||
        windSpeedKmh === null ||
        windFromDeg === null
      ) {
        return;
      }

      const candidate = {
        time: new Date(timeMs).toISOString(),
        windSpeedKmh,
        windFromDeg: windFromDeg % 360,
        swellHeightM,
        swellPeriodS,
        swellFromDeg: swellFromDeg % 360,
        windGustKmh: bounded(wind.gust, 1, 0, 500),
        airTempC: bounded(wind.temp, 1, -90, 60),
        waterTempC: bounded(marine.hourly.sea_surface_temperature?.[index], 1, -5, 45),
        cloudCoverPct: bounded(wind.cloud, 0, 0, 100),
        pressureHpa: bounded(wind.pressure, 0, 870, 1090),
      };

      // Dernier filet : si le schéma refuse malgré tout, on perd l'heure, pas
      // la journée. Une exception ici ferait retomber le spot entier sur les
      // données simulées.
      const parsed = marinePointSchema.safeParse(candidate);
      if (parsed.success) points.push(parsed.data);
    });

    if (points.length === 0) {
      throw new OpenMeteoError(
        `Aucune heure exploitable renvoyée pour ${spot.slug} (${spot.lat}, ${spot.lng}).`,
      );
    }

    return {
      data: points,
      source: this.source,
      refreshedAt: new Date().toISOString(),
    };
  }

  private async fetchMarine(spot: Spot) {
    const url = this.buildUrl(this.options.marineUrl, spot, {
      hourly: 'wave_height,wave_period,wave_direction,sea_surface_temperature',
    });
    return openMeteoMarineSchema.parse(await this.getJson(url, 'marine'));
  }

  private async fetchForecast(spot: Spot) {
    const url = this.buildUrl(this.options.forecastUrl, spot, {
      hourly:
        'wind_speed_10m,wind_direction_10m,wind_gusts_10m,temperature_2m,cloud_cover,pressure_msl',
      wind_speed_unit: 'kmh',
    });
    return openMeteoForecastSchema.parse(await this.getJson(url, 'forecast'));
  }

  private buildUrl(base: string, spot: Spot, extra: Record<string, string>): string {
    const url = new URL(base);
    url.searchParams.set('latitude', spot.lat.toFixed(4));
    url.searchParams.set('longitude', spot.lng.toFixed(4));
    url.searchParams.set('timeformat', 'unixtime');
    url.searchParams.set('timezone', 'UTC');
    // `past_days=1` couvre la marge de 8 h en amont demandée par la prévision.
    url.searchParams.set('past_days', '1');
    url.searchParams.set('forecast_days', String(FORECAST_DAYS));
    url.searchParams.set('cell_selection', 'sea');
    for (const [key, value] of Object.entries(extra)) url.searchParams.set(key, value);
    return url.toString();
  }

  private async getJson(url: string, label: string): Promise<unknown> {
    let response: Response;

    try {
      response = await this.options.fetchImpl(url, {
        // Mise en cache côté Next : 12 spots × 2 appels ne doivent pas partir
        // à chaque requête. Sans réseau au build, l'erreur remonte au repli.
        next: { revalidate: this.options.revalidateSeconds },
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(this.options.timeoutMs),
      } as RequestInit);
    } catch (error) {
      const timedOut = error instanceof Error && error.name === 'TimeoutError';
      throw new OpenMeteoError(
        timedOut
          ? `Open-Meteo (${label}) n'a pas répondu en ${this.options.timeoutMs} ms.`
          : `Open-Meteo (${label}) injoignable.`,
        { cause: error },
      );
    }

    const payload: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      const parsed = openMeteoErrorSchema.safeParse(payload);
      throw new OpenMeteoError(
        `Open-Meteo (${label}) a répondu ${response.status}${parsed.success ? ` : ${parsed.data.reason}` : ''}.`,
      );
    }

    return payload;
  }
}
