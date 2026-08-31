import { generateMarineSeries } from '@/data/generators/marine';
import type { MarinePoint, Spot } from '@/data/schemas';
import { marinePointSchema } from '@/data/schemas';
import type { DateRange, Sourced, WeatherProvider } from '../types';

/**
 * Conditions marines simulées.
 *
 * ➜ POUR BRANCHER OPEN-METEO MARINE : créer
 *   `src/lib/providers/open-meteo/weather.ts` exposant le même
 *   `WeatherProvider`, appeler `marine-api.open-meteo.com/v1/marine`
 *   (`wave_height`, `wave_period`, `wave_direction`) et
 *   `api.open-meteo.com/v1/forecast` (`wind_speed_10m`, `wind_gusts_10m`,
 *   `wind_direction_10m`, `temperature_2m`, `cloud_cover`, `pressure_msl`),
 *   recomposer les tableaux parallèles en `MarinePoint[]`, puis changer la
 *   ligne `weather:` de `src/lib/providers/index.ts`.
 */
export class MockWeatherProvider implements WeatherProvider {
  readonly source = {
    name: 'Météo marine — modèle de démonstration Moonfish',
    kind: 'simulated' as const,
    precision:
      'Série continue générée à partir du slug du spot. Physiquement plausible, mais sans aucun rapport avec les conditions réelles.',
  };

  async getMarineSeries(spot: Spot, range: DateRange): Promise<Sourced<MarinePoint[]>> {
    const series = generateMarineSeries(spot, range.from, range.to).map((point) =>
      marinePointSchema.parse(point),
    );

    return {
      data: series,
      source: this.source,
      refreshedAt: range.from.toISOString(),
    };
  }
}
