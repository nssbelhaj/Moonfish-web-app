import type { TideEvent } from '@/data/schemas';

/**
 * Reconstruction de la courbe de marée entre deux extremums.
 *
 * L'interpolation est cosinusoïdale et non linéaire : c'est la forme réelle de
 * l'onde de marée. Une interpolation droite ferait croire à une montée
 * régulière, alors que la moitié de la hauteur se joue dans les deux heures
 * centrales — l'erreur exacte qui fait se faire surprendre sur un estran plat.
 *
 * Module pur : il travaille sur des `TideEvent`, donc indifféremment sur les
 * marées simulées d'aujourd'hui et sur celles de Stormglass demain.
 */

export interface TideSample {
  /** Instant, en millisecondes epoch. */
  time: number;
  heightM: number;
}

function sorted(events: readonly TideEvent[]): TideEvent[] {
  return [...events].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
}

/**
 * Hauteur d'eau à un instant donné.
 * `null` hors de la plage couverte par les extremums : on n'extrapole pas au-delà
 * de ce qui est connu.
 */
export function tideHeightAt(instant: Date, events: readonly TideEvent[]): number | null {
  const list = sorted(events);
  if (list.length < 2) return null;

  const t = instant.getTime();
  const first = list[0] as TideEvent;
  const last = list[list.length - 1] as TideEvent;
  if (t < new Date(first.time).getTime() || t > new Date(last.time).getTime()) return null;

  for (let i = 0; i < list.length - 1; i += 1) {
    const from = list[i] as TideEvent;
    const to = list[i + 1] as TideEvent;
    const t0 = new Date(from.time).getTime();
    const t1 = new Date(to.time).getTime();
    if (t < t0 || t > t1) continue;
    if (t1 === t0) return from.heightM;

    const ratio = (t - t0) / (t1 - t0);
    const eased = (1 - Math.cos(Math.PI * ratio)) / 2;
    return from.heightM + (to.heightM - from.heightM) * eased;
  }

  return null;
}

/** Échantillonne la courbe sur [from, to], `steps` intervalles. */
export function sampleTideCurve(
  events: readonly TideEvent[],
  from: Date,
  to: Date,
  steps = 144,
): TideSample[] {
  const samples: TideSample[] = [];
  const span = to.getTime() - from.getTime();
  if (span <= 0 || steps <= 0) return samples;

  for (let i = 0; i <= steps; i += 1) {
    const time = from.getTime() + (span * i) / steps;
    const heightM = tideHeightAt(new Date(time), events);
    if (heightM !== null) samples.push({ time, heightM });
  }

  return samples;
}

/** Bornes de hauteur utiles au tracé, avec une marge pour ne pas coller aux bords. */
export function tideBounds(
  events: readonly TideEvent[],
  padding = 0.15,
): { min: number; max: number } | null {
  if (events.length === 0) return null;
  const heights = events.map((event) => event.heightM);
  const min = Math.min(...heights);
  const max = Math.max(...heights);
  const span = Math.max(0.2, max - min);
  return { min: min - span * padding, max: max + span * padding };
}

/** Extremums couvrant l'intervalle, plus celui de chaque côté pour fermer la courbe. */
export function eventsAround(
  events: readonly TideEvent[],
  from: Date,
  to: Date,
): TideEvent[] {
  const list = sorted(events);
  const before = list.filter((event) => new Date(event.time).getTime() < from.getTime()).slice(-1);
  const inside = list.filter((event) => {
    const t = new Date(event.time).getTime();
    return t >= from.getTime() && t <= to.getTime();
  });
  const after = list.filter((event) => new Date(event.time).getTime() > to.getTime()).slice(0, 1);
  return [...before, ...inside, ...after];
}
