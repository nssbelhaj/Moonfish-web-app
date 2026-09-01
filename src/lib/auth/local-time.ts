/**
 * « 2026-09-01T18:30 » + décalage du navigateur → instant ISO.
 *
 * Un `<input type="datetime-local">` ne transmet AUCUN fuseau : la même chaîne
 * désigne 18 h 30 à Brest et 18 h 30 à Agadir. L'interpréter en UTC daterait
 * chaque prise de deux heures à côté en été, ce qui la ferait tomber dans le
 * mauvais créneau de marée — l'erreur exacte que ce site existe pour éviter.
 *
 * Le décalage vient d'un champ caché rempli par `getTimezoneOffset()`, qui rend
 * l'OPPOSÉ du décalage usuel : +120 min en France l'été, pas −120. D'où
 * l'addition ci-dessous ; l'inverser décalerait la prise de quatre heures.
 */
export function localDateTimeToIso(value: string, offsetMinutes: number): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;

  const [, year, month, day, hour, minute] = match;
  const asUtc = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
  const instant = new Date(asUtc + offsetMinutes * 60_000);

  return Number.isNaN(instant.getTime()) ? null : instant.toISOString();
}

/** Valeur pour un `<input type="datetime-local">` à partir d'un instant. */
export function isoToLocalDateTime(instant: Date, offsetMinutes: number): string {
  const shifted = new Date(instant.getTime() - offsetMinutes * 60_000);
  return shifted.toISOString().slice(0, 16);
}
