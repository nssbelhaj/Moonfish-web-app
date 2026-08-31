import type { TideEvent } from '@/data/schemas';
import type { TideInput } from '@/lib/scoring';

/**
 * Reconstruit l'entrée « marée » du score à partir d'une simple liste de pleines
 * et basses mers.
 *
 * C'est délibéré : cette fonction ne connaît RIEN du générateur de mock. Elle
 * travaille sur la même structure que celle renvoyée par
 * `tide/extremes/point` chez Stormglass, donc elle fonctionnera à l'identique
 * le jour du branchement, sans être retouchée.
 */
export function tideContextAt(instant: Date, events: readonly TideEvent[]): TideInput | null {
  if (events.length === 0) return null;

  const sorted = [...events].sort(
    (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime(),
  );

  const highs = sorted.filter((event) => event.type === 'high');
  if (highs.length === 0) return null;

  const t = instant.getTime();

  let nearestHigh = highs[0] as TideEvent;
  for (const high of highs) {
    if (Math.abs(new Date(high.time).getTime() - t) < Math.abs(new Date(nearestHigh.time).getTime() - t)) {
      nearestHigh = high;
    }
  }

  const hoursFromHighTide = (t - new Date(nearestHigh.time).getTime()) / 3_600_000;

  // Le coefficient est celui de l'extremum le plus proche, quel qu'il soit.
  let nearestEvent = sorted[0] as TideEvent;
  for (const event of sorted) {
    if (Math.abs(new Date(event.time).getTime() - t) < Math.abs(new Date(nearestEvent.time).getTime() - t)) {
      nearestEvent = event;
    }
  }

  const minutesToNearestEvent =
    Math.abs(new Date(nearestEvent.time).getTime() - t) / 60_000;

  const next = sorted.find((event) => new Date(event.time).getTime() > t);
  const state: TideInput['state'] =
    minutesToNearestEvent < 18 ? 'slack' : next?.type === 'high' ? 'rising' : 'falling';

  return {
    hoursFromHighTide,
    coefficient: nearestEvent.coefficient,
    state,
  };
}

/** Prochaine pleine mer strictement après `instant`. */
export function nextHighTide(instant: Date, events: readonly TideEvent[]): TideEvent | null {
  return (
    events
      .filter((event) => event.type === 'high' && new Date(event.time).getTime() > instant.getTime())
      .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())[0] ?? null
  );
}

/** Marées d'une journée locale donnée, bornes en instants UTC. */
export function tideEventsBetween(
  events: readonly TideEvent[],
  from: Date,
  to: Date,
): TideEvent[] {
  return events.filter((event) => {
    const t = new Date(event.time).getTime();
    return t >= from.getTime() && t < to.getTime();
  });
}
