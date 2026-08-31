import { generateTideEvents } from '@/data/generators/tide';
import type { Spot, TideEvent } from '@/data/schemas';
import { tideEventSchema } from '@/data/schemas';
import type { DateRange, Sourced, TideProvider } from '../types';

/**
 * Marées simulées.
 *
 * ➜ POUR BRANCHER STORMGLASS : créer `src/lib/providers/stormglass/tide.ts`
 *   exposant le même `TideProvider`, appeler `GET /v2/tide/extremes/point`,
 *   mapper `{ time, type, height }` vers `TideEvent` en récupérant le
 *   coefficient auprès du SHOM, puis changer la ligne `tides:` de
 *   `src/lib/providers/index.ts`. Rien d'autre ne bouge.
 */
export class MockTideProvider implements TideProvider {
  readonly source = {
    name: 'Modèle de démonstration Moonfish',
    kind: 'simulated' as const,
    precision:
      'Onde semi-diurne M2 pure, sans harmoniques locales. Les horaires peuvent s’écarter de plusieurs dizaines de minutes de la réalité.',
  };

  async getTideEvents(spot: Spot, range: DateRange): Promise<Sourced<TideEvent[]>> {
    const events = generateTideEvents(spot, range.from, range.to).map((event) =>
      tideEventSchema.parse(event),
    );

    return {
      data: events,
      source: this.source,
      refreshedAt: range.from.toISOString(),
    };
  }
}
