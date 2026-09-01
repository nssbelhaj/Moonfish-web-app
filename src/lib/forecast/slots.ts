import type { MarinePoint, Spot, TideEvent } from '@/data/schemas';
import { hoursToNearest, lightPhaseAt, moonAgeDays, moonIlluminationPct, solunarPeriods, sunTimes } from '@/lib/astro';
import { computeScore, type ScoreResult } from '@/lib/scoring';
import { addHours, localCalendarNoonUtc, startOfLocalDay } from '@/lib/time';
import { tideContextAt } from './tide-context';

/**
 * Granularité du produit : des créneaux de DEUX heures, soit douze par jour.
 *
 * Trois heures était trop large pour une marée : une fenêtre de pleine mer dure
 * environ trois heures, si bien qu'un créneau de trois heures pouvait mélanger
 * le meilleur et le pire du cycle en une seule note. Deux heures suivent le
 * mouvement de l'eau d'assez près pour que la note veuille dire quelque chose.
 */
export const SLOT_HOURS = 2;
export const SLOTS_PER_DAY = 24 / SLOT_HOURS;
export const FORECAST_DAYS = 7;

export interface ForecastSlot {
  /** Début du créneau, ISO. */
  start: string;
  /** Fin du créneau, ISO (exclusive). */
  end: string;
  score: ScoreResult;
  /**
   * Conditions relevées au milieu du créneau, représentatives des trois heures.
   * `null` si la série marine ne couvre pas cet instant — même règle que la
   * marée : le créneau reste, et le score dit ce qui lui manque (D11).
   */
  conditions: MarinePoint | null;
  /**
   * Contexte de marée au milieu du créneau, `null` si le fournisseur de marées
   * n'a rien couvert ici. Le créneau existe quand même : le faire disparaître
   * masquerait une panne au lieu de la déclarer (D11).
   */
  tide: { hoursFromHighTide: number; coefficient: number; state: 'rising' | 'falling' | 'slack' } | null;
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

    // Éphémérides de la DATE LOCALE, pas de la date UTC de minuit local :
    // voir `localCalendarNoonUtc`.
    const ephemerisDay = localCalendarNoonUtc(dayStart, spot.timezone);
    const sun = sunTimes(ephemerisDay, spot.lat, spot.lng);
    const solunar = solunarPeriods(ephemerisDay, spot.lng);

    const slots: ForecastSlot[] = [];

    for (let slotIndex = 0; slotIndex < SLOTS_PER_DAY; slotIndex += 1) {
      const start = addHours(dayStart, slotIndex * SLOT_HOURS);
      const end = addHours(start, SLOT_HOURS);
      const middle = addHours(start, SLOT_HOURS / 2);

      // Marée ou météo absente : le créneau est conservé et le score se calcule
      // sans elle, poids renormalisés. Sauter le créneau ferait disparaître trois
      // heures de la journée sans que rien ne l'explique — une panne de
      // fournisseur ressemblerait alors à une nuit sans données plutôt qu'à une
      // panne.
      const conditions = marineByHour.get(Math.floor(middle.getTime() / 3_600_000)) ?? null;
      const tide = tideContextAt(middle, tideEvents) ?? null;

      const score = computeScore({
        spotFacingDeg: spot.facingDeg,
        tide,
        wind:
          conditions === null
            ? null
            : { speedKmh: conditions.windSpeedKmh, fromDeg: conditions.windFromDeg },
        swell:
          conditions === null
            ? null
            : { heightM: conditions.swellHeightM, periodS: conditions.swellPeriodS },
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
  // Un créneau sans score n'est pas « le meilleur » non plus : on ne recommande
  // pas une sortie sur une absence de donnée.
  const pool = slots.filter(
    (slot) => slot.score.safety.level !== 'danger' && slot.score.value !== null,
  );
  return pool.reduce<ForecastSlot | null>(
    (best, slot) =>
      best === null || (slot.score.value ?? 0) > (best.score.value ?? 0) ? slot : best,
    null,
  );
}

/** Palier à partir duquel un créneau est signalé comme favorable à l'utilisateur. */
export const FAVOURABLE_FROM = 6;

/**
 * Créneaux favorables d'une journée.
 *
 * Un créneau dangereux est exclu quel que soit son score : signaler comme
 * « favorable » un créneau où l'on ne doit pas descendre serait le pire usage
 * possible de ce produit. C'est la même règle que `bestSlot`, énoncée une seule
 * fois plutôt que réécrite dans chaque composant qui l'affiche.
 */
export function favourableSlots(
  slots: readonly ForecastSlot[],
  threshold: number = FAVOURABLE_FROM,
): ForecastSlot[] {
  return slots.filter(
    (slot) =>
      slot.score.value !== null &&
      slot.score.value >= threshold &&
      slot.score.safety.level !== 'danger',
  );
}

/** Premier créneau à venir dont le score atteint le palier « Bon » et qui n'est pas dangereux. */
export function nextGoodWindow(days: readonly ForecastDay[], now: Date): ForecastSlot | null {
  for (const day of days) {
    for (const slot of day.slots) {
      if (new Date(slot.end).getTime() <= now.getTime()) continue;
      if (slot.score.safety.level === 'danger') continue;
      if (slot.score.value !== null && slot.score.value >= 6) return slot;
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
