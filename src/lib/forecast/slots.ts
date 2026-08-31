import type { MarinePoint, Spot, TideEvent } from '@/data/schemas';
import { hoursToNearest, lightPhaseAt, moonAgeDays, moonIlluminationPct, solunarPeriods, sunTimes } from '@/lib/astro';
import { computeScore, type ScoreResult } from '@/lib/scoring';
import { addHours, startOfLocalDay } from '@/lib/time';
import { tideContextAt } from './tide-context';

/** Le handoff cadre la TimeWindowBar sur 8 colonnes de 3 h : c'est la granularité du produit. */
export const SLOT_HOURS = 3;
export const SLOTS_PER_DAY = 24 / SLOT_HOURS;
export const FORECAST_DAYS = 7;

export interface ForecastSlot {
  /** Début du créneau, ISO. */
  start: string;
  /** Fin du créneau, ISO (exclusive). */
  end: string;
  score: ScoreResult;
  /** Conditions relevées au milieu du créneau, représentatives des trois heures. */
  conditions: MarinePoint;
  tide: { hoursFromHighTide: number; coefficient: number; state: 'rising' | 'falling' | 'slack' };
  lightPhase: 'dawn' | 'day' | 'dusk' | 'night';
}

export interface ForecastDay {
  /** Minuit local, ISO. */
  date: string;
  slots: ForecastSlot[];
  sunrise: string | null;
  sunset: string | null;
  tideEvents: TideEvent[];
  moonIlluminationPct: number;
  moonAgeDays: number;
  /** Meilleur créneau de la journée, sécurité comprise. */
  best: ForecastSlot | null;
}

/**
 * Assemble les données brutes des fournisseurs en créneaux scorés.
 *
 * Cette fonction est pure et ne connaît aucun fournisseur : elle reçoit des
 * `TideEvent[]` et des `MarinePoint[]`, peu importe qui les a produits. C'est
 * ce qui garantit qu'un passage à Stormglass ne la fera pas bouger.
 */
export function buildForecastDays(
  spot: Spot,
  anchor: Date,
  tideEvents: readonly TideEvent[],
  marine: readonly MarinePoint[],
): ForecastDay[] {
  const marineByHour = new Map<number, MarinePoint>();
  for (const point of marine) {
    marineByHour.set(Math.floor(new Date(point.time).getTime() / 3_600_000), point);
  }

  const days: ForecastDay[] = [];
  const firstMidnight = startOfLocalDay(anchor, spot.timezone);

  for (let dayIndex = 0; dayIndex < FORECAST_DAYS; dayIndex += 1) {
    const dayStart = startOfLocalDay(addHours(firstMidnight, dayIndex * 24 + 6), spot.timezone);
    const dayEnd = startOfLocalDay(addHours(dayStart, 30), spot.timezone);

    const sun = sunTimes(dayStart, spot.lat, spot.lng);
    const solunar = solunarPeriods(dayStart, spot.lng);

    const slots: ForecastSlot[] = [];

    for (let slotIndex = 0; slotIndex < SLOTS_PER_DAY; slotIndex += 1) {
      const start = addHours(dayStart, slotIndex * SLOT_HOURS);
      const end = addHours(start, SLOT_HOURS);
      const middle = addHours(start, SLOT_HOURS / 2);

      const conditions = marineByHour.get(Math.floor(middle.getTime() / 3_600_000));
      const tide = tideContextAt(middle, tideEvents);
      if (!conditions || !tide) continue;

      const score = computeScore({
        spotFacingDeg: spot.facingDeg,
        tide,
        wind: { speedKmh: conditions.windSpeedKmh, fromDeg: conditions.windFromDeg },
        swell: { heightM: conditions.swellHeightM, periodS: conditions.swellPeriodS },
        solunar: {
          hoursToMajorPeriod: hoursToNearest(middle, solunar.major),
          hoursToMinorPeriod: hoursToNearest(middle, solunar.minor),
          moonIlluminationPct: moonIlluminationPct(middle),
          moonAgeDays: moonAgeDays(middle),
        },
        light: { phase: lightPhaseAt(middle, sun) },
      });

      slots.push({
        start: start.toISOString(),
        end: end.toISOString(),
        score,
        conditions,
        tide,
        lightPhase: lightPhaseAt(middle, sun),
      });
    }

    days.push({
      date: dayStart.toISOString(),
      slots,
      sunrise: sun.sunrise?.toISOString() ?? null,
      sunset: sun.sunset?.toISOString() ?? null,
      tideEvents: tideEvents.filter((event) => {
        const t = new Date(event.time).getTime();
        return t >= dayStart.getTime() && t < dayEnd.getTime();
      }),
      moonIlluminationPct: moonIlluminationPct(dayStart),
      moonAgeDays: moonAgeDays(dayStart),
      best: bestSlot(slots),
    });
  }

  return days;
}

/**
 * Meilleur créneau d'une liste.
 * Un créneau en danger n'est jamais « le meilleur », quel que soit son score :
 * proposer une sortie dangereuse comme recommandation serait le pire usage
 * possible de ce produit.
 */
export function bestSlot(slots: readonly ForecastSlot[]): ForecastSlot | null {
  const safe = slots.filter((slot) => slot.score.safety.level !== 'danger');
  const pool = safe.length > 0 ? safe : [];
  return pool.reduce<ForecastSlot | null>(
    (best, slot) => (best === null || slot.score.value > best.score.value ? slot : best),
    null,
  );
}

/** Premier créneau à venir dont le score atteint le palier « Bon » et qui n'est pas dangereux. */
export function nextGoodWindow(days: readonly ForecastDay[], now: Date): ForecastSlot | null {
  for (const day of days) {
    for (const slot of day.slots) {
      if (new Date(slot.end).getTime() <= now.getTime()) continue;
      if (slot.score.safety.level === 'danger') continue;
      if (slot.score.value >= 6) return slot;
    }
  }
  return null;
}

/** Créneau courant, ou à défaut le premier créneau à venir. */
export function currentSlot(days: readonly ForecastDay[], now: Date): ForecastSlot | null {
  const all = days.flatMap((day) => day.slots);
  const active = all.find(
    (slot) =>
      new Date(slot.start).getTime() <= now.getTime() && new Date(slot.end).getTime() > now.getTime(),
  );
  if (active) return active;
  return all.find((slot) => new Date(slot.start).getTime() > now.getTime()) ?? all[0] ?? null;
}
