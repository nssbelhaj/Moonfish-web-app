import { z } from 'zod';

/**
 * Forme des réponses Open-Meteo.
 *
 * Open-Meteo répond en TABLEAUX PARALLÈLES indexés par `hourly.time`, et non en
 * liste d'objets. Chaque série peut contenir des `null` là où le modèle ne
 * couvre pas la maille. Ces schémas décrivent ça tel quel : la recomposition en
 * objets se fait dans le provider, après validation, jamais avant.
 *
 * On demande `timeformat=unixtime` : les horodatages arrivent en secondes epoch,
 * ce qui supprime toute ambiguïté de fuseau à l'analyse.
 */

const hourlySeries = z.array(z.number().nullable());

export const openMeteoMarineSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  hourly: z.object({
    time: z.array(z.number()),
    wave_height: hourlySeries,
    wave_period: hourlySeries,
    wave_direction: hourlySeries,
    sea_surface_temperature: hourlySeries.optional(),
  }),
});

export type OpenMeteoMarine = z.infer<typeof openMeteoMarineSchema>;

export const openMeteoForecastSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  hourly: z.object({
    time: z.array(z.number()),
    wind_speed_10m: hourlySeries,
    wind_direction_10m: hourlySeries,
    wind_gusts_10m: hourlySeries.optional(),
    temperature_2m: hourlySeries.optional(),
    cloud_cover: hourlySeries.optional(),
    pressure_msl: hourlySeries.optional(),
    precipitation_probability: hourlySeries.optional(),
    uv_index: hourlySeries.optional(),
    visibility: hourlySeries.optional(),
    apparent_temperature: hourlySeries.optional(),
    relative_humidity_2m: hourlySeries.optional(),
    dew_point_2m: hourlySeries.optional(),
  }),
});

export type OpenMeteoForecast = z.infer<typeof openMeteoForecastSchema>;

/** Open-Meteo signale ses erreurs avec `{ error: true, reason: "..." }` et un code 400. */
export const openMeteoErrorSchema = z.object({
  error: z.literal(true),
  reason: z.string(),
});
