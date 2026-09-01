/**
 * Manipulation de dates dans le fuseau du spot.
 *
 * Les créneaux sont découpés sur la journée LOCALE du spot : un pêcheur à
 * Taghazout ne raisonne pas en UTC. Tout est fait avec `Intl`, sans dépendance,
 * et reste correct au passage à l'heure d'été.
 */

const MS_PER_HOUR = 3_600_000;
export const MS_PER_DAY = 86_400_000;

/** Décalage du fuseau par rapport à UTC, en millisecondes, à l'instant donné. */
export function timeZoneOffsetMs(timeZone: string, date: Date): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const parts: Record<string, number> = {};
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== 'literal') parts[part.type] = Number(part.value);
  }

  const asUtc = Date.UTC(
    parts.year ?? 1970,
    (parts.month ?? 1) - 1,
    parts.day ?? 1,
    (parts.hour ?? 0) % 24,
    parts.minute ?? 0,
    parts.second ?? 0,
  );

  return asUtc - date.getTime();
}

/** Instant UTC correspondant à minuit local dans le fuseau donné. */
export function startOfLocalDay(date: Date, timeZone: string): Date {
  const offset = timeZoneOffsetMs(timeZone, date);
  const local = new Date(date.getTime() + offset);
  const localMidnight = Date.UTC(
    local.getUTCFullYear(),
    local.getUTCMonth(),
    local.getUTCDate(),
  );

  let candidate = localMidnight - offset;
  // Un changement d'heure dans la journée décale le résultat d'une heure :
  // une seconde passe suffit à retomber juste.
  const corrected = timeZoneOffsetMs(timeZone, new Date(candidate));
  if (corrected !== offset) candidate = localMidnight - corrected;

  return new Date(candidate);
}

/**
 * Midi UTC de la DATE CIVILE LOCALE d'un instant.
 *
 * Les éphémérides (`sunTimes`, `solunarPeriods`) sont calculées pour une date
 * civile, qu'elles lisent sur le calendrier UTC de l'instant reçu. Leur passer
 * minuit local est donc un piège : à Paris, minuit du 1er septembre vaut
 * 22 h UTC le 31 août, et l'on obtient les éphémérides de la VEILLE. Le lever
 * et le coucher calculés tombaient alors avant le début de la journée affichée,
 * et `lightPhaseAt` classait les huit créneaux en « nuit » — y compris ceux de
 * l'après-midi.
 *
 * Midi UTC de la date locale lève l'ambiguïté pour tout fuseau de -11 à +12 :
 * la date civile passée est toujours celle que l'utilisateur voit à l'écran.
 */
export function localCalendarNoonUtc(date: Date, timeZone: string): Date {
  const offset = timeZoneOffsetMs(timeZone, date);
  const local = new Date(date.getTime() + offset);
  return new Date(
    Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), 12),
  );
}

/** Heure locale décimale (13.5 = 13 h 30). */
export function localHours(date: Date, timeZone: string): number {
  const offset = timeZoneOffsetMs(timeZone, date);
  const local = new Date(date.getTime() + offset);
  return local.getUTCHours() + local.getUTCMinutes() / 60;
}

export function formatTime(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function formatDayShort(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone,
    weekday: 'short',
    day: 'numeric',
  }).format(date);
}

/** « mar », « mer » — la graduation de la règle des jours (D1). */
export function formatWeekdayShort(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('fr-FR', { timeZone, weekday: 'short' })
    .format(date)
    .replace('.', '');
}

/** « 02 » — le quantième, sur deux chiffres, aligné en chasse tabulaire. */
export function formatDayNumber(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('fr-FR', { timeZone, day: '2-digit' }).format(date);
}

export function formatDayLong(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date);
}

export function formatDateTime(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone,
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * MS_PER_HOUR);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}
