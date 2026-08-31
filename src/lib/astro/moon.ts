/**
 * Lune : âge de la lunaison, illumination, périodes solunaires.
 *
 * L'âge et l'illumination sont calculés (précision de l'ordre de l'heure).
 * Les instants de passage au méridien, eux, sont une APPROXIMATION assumée :
 * la Lune retarde en moyenne de 50,5 min par jour, ce qui suffit à situer les
 * périodes majeures à ~20 min près mais pas davantage. L'interface doit le dire
 * plutôt que d'afficher une fausse précision.
 */

/** Durée moyenne d'une lunaison, en jours. */
export const SYNODIC_MONTH_D = 29.530588;

/** Nouvelle lune de référence : 6 janvier 2000, 18 h 14 UTC. */
const REFERENCE_NEW_MOON_MS = Date.UTC(2000, 0, 6, 18, 14);

const MS_PER_DAY = 86_400_000;

/** Âge de la lunaison en jours, dans [0, 29.53). */
export function moonAgeDays(date: Date): number {
  const elapsed = (date.getTime() - REFERENCE_NEW_MOON_MS) / MS_PER_DAY;
  const age = elapsed % SYNODIC_MONTH_D;
  return age < 0 ? age + SYNODIC_MONTH_D : age;
}

/** Fraction éclairée du disque, 0–100. */
export function moonIlluminationPct(date: Date): number {
  const phaseAngle = (2 * Math.PI * moonAgeDays(date)) / SYNODIC_MONTH_D;
  return ((1 - Math.cos(phaseAngle)) / 2) * 100;
}

export interface SolunarPeriods {
  /** Passages au méridien (zénith et nadir) — périodes majeures. */
  major: Date[];
  /** Lever et coucher de Lune — périodes mineures. */
  minor: Date[];
}

/**
 * Périodes solunaires approchées pour un jour et une longitude donnés.
 *
 * Modèle : le passage au méridien supérieur retarde de 24,84 h par jour lunaire.
 * Le nadir est à mi-chemin ; lever et coucher sont posés à ±6 h 12 du zénith,
 * ce qui est exact à l'équinoxe et dérive avec la latitude. Suffisant pour
 * pondérer 15 % d'un score, insuffisant pour être présenté comme une éphéméride.
 */
export function solunarPeriods(date: Date, longitude: number): SolunarPeriods {
  const dayStart = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const age = moonAgeDays(new Date(dayStart));

  // Décalage du passage au méridien par rapport au midi solaire local.
  const lagHours = (age / SYNODIC_MONTH_D) * 24.84;
  const solarNoonUtc = 12 - longitude / 15;

  const upper = solarNoonUtc + lagHours;
  const transits = [upper - 24.84, upper, upper + 24.84];

  const major: Date[] = [];
  const minor: Date[] = [];

  for (const transit of transits) {
    for (const offset of [0, 12.42]) {
      major.push(new Date(dayStart + (transit + offset) * 3_600_000));
    }
    for (const offset of [-6.21, 6.21]) {
      minor.push(new Date(dayStart + (transit + offset) * 3_600_000));
    }
  }

  return { major, minor };
}

/** Écart absolu, en heures, entre un instant et l'élément le plus proche d'une liste. */
export function hoursToNearest(instant: Date, moments: Date[]): number {
  let best = Number.POSITIVE_INFINITY;
  for (const moment of moments) {
    const delta = Math.abs(instant.getTime() - moment.getTime()) / 3_600_000;
    if (delta < best) best = delta;
  }
  return best;
}
