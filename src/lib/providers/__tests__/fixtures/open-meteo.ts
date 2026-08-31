/**
 * Réponses Open-Meteo de référence.
 *
 * Reproduisent fidèlement la forme réelle de l'API : tableaux parallèles
 * indexés par `hourly.time`, horodatages en secondes epoch (`timeformat=unixtime`),
 * et `null` là où le modèle ne couvre pas la maille.
 */

/** 2026-09-01T00:00:00Z, en secondes epoch. */
export const T0 = Math.floor(Date.UTC(2026, 8, 1) / 1000);
const HOUR = 3600;

interface MarineOverrides {
  wave_height?: (number | null)[];
  wave_period?: (number | null)[];
  wave_direction?: (number | null)[];
  sea_surface_temperature?: (number | null)[];
  startEpoch?: number;
  hours?: number;
}

export function marineResponse(overrides: MarineOverrides = {}) {
  const hours = overrides.hours ?? 6;
  const start = overrides.startEpoch ?? T0;

  return {
    latitude: 48.3,
    longitude: -4.6,
    generationtime_ms: 0.21,
    utc_offset_seconds: 0,
    timezone: 'GMT',
    timezone_abbreviation: 'GMT',
    elevation: 0,
    hourly_units: {
      time: 'unixtime',
      wave_height: 'm',
      wave_period: 's',
      wave_direction: '°',
      sea_surface_temperature: '°C',
    },
    hourly: {
      time: Array.from({ length: hours }, (_, i) => start + i * HOUR),
      wave_height: overrides.wave_height ?? [1.24, 1.31, 1.4, 1.52, 1.48, 1.39],
      wave_period: overrides.wave_period ?? [8.5, 8.7, 9.1, 9.4, 9.2, 8.9],
      wave_direction: overrides.wave_direction ?? [281, 283, 285, 288, 286, 284],
      sea_surface_temperature:
        overrides.sea_surface_temperature ?? [17.4, 17.4, 17.3, 17.3, 17.4, 17.5],
    },
  };
}

interface ForecastOverrides {
  wind_speed_10m?: (number | null)[];
  wind_direction_10m?: (number | null)[];
  wind_gusts_10m?: (number | null)[];
  temperature_2m?: (number | null)[];
  cloud_cover?: (number | null)[];
  pressure_msl?: (number | null)[];
  startEpoch?: number;
  hours?: number;
}

export function forecastResponse(overrides: ForecastOverrides = {}) {
  const hours = overrides.hours ?? 6;
  const start = overrides.startEpoch ?? T0;

  return {
    latitude: 48.3,
    longitude: -4.6,
    generationtime_ms: 0.09,
    utc_offset_seconds: 0,
    timezone: 'GMT',
    timezone_abbreviation: 'GMT',
    elevation: 12,
    hourly_units: {
      time: 'unixtime',
      wind_speed_10m: 'km/h',
      wind_direction_10m: '°',
      wind_gusts_10m: 'km/h',
      temperature_2m: '°C',
      cloud_cover: '%',
      pressure_msl: 'hPa',
    },
    hourly: {
      time: Array.from({ length: hours }, (_, i) => start + i * HOUR),
      wind_speed_10m: overrides.wind_speed_10m ?? [14.8, 16.2, 18.4, 21.1, 19.6, 17.2],
      wind_direction_10m: overrides.wind_direction_10m ?? [268, 271, 274, 279, 277, 275],
      wind_gusts_10m: overrides.wind_gusts_10m ?? [22.7, 25.2, 28.8, 33.1, 30.2, 26.6],
      temperature_2m: overrides.temperature_2m ?? [16.1, 15.9, 15.8, 16.4, 17.2, 18.1],
      cloud_cover: overrides.cloud_cover ?? [75, 82, 90, 88, 64, 41],
      pressure_msl: overrides.pressure_msl ?? [1014, 1013, 1013, 1012, 1012, 1013],
    },
  };
}

/** `fetch` factice qui aiguille selon l'hôte appelé et retient les URL vues. */
export function stubFetch(handlers: {
  marine?: () => Response | Promise<Response>;
  forecast?: () => Response | Promise<Response>;
} = {}): { impl: typeof fetch; urls: string[] } {
  const urls: string[] = [];

  const impl = (async (input: RequestInfo | URL): Promise<Response> => {
    const url = typeof input === 'string' ? input : input.toString();
    urls.push(url);

    if (url.includes('marine')) {
      return handlers.marine ? handlers.marine() : Response.json(marineResponse());
    }
    return handlers.forecast ? handlers.forecast() : Response.json(forecastResponse());
  }) as unknown as typeof fetch;

  return { impl, urls };
}
