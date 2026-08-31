/**
 * Position du Soleil — algorithme NOAA, implémenté localement.
 *
 * Ces valeurs ne sont PAS simulées : elles sont calculées, hors ligne et sans
 * dépendance, avec une précision de l'ordre de la minute. C'est ce qui permet
 * d'étiqueter honnêtement l'aube et le crépuscule comme « calculé » alors que
 * la marée et la houle du MVP sont, elles, des données de démonstration.
 */

const DEG = Math.PI / 180;
const MS_PER_DAY = 86_400_000;
/** Jour julien de l'époque J2000.0. */
const J2000 = 2_451_545;
const JULIAN_1970 = 2_440_588;

// Le jour julien commence à midi UTC, d'où le -0.5 : l'oublier décale
// l'ensemble des levers et couchers de exactement douze heures.
function toJulian(date: Date): number {
  return date.getTime() / MS_PER_DAY - 0.5 + JULIAN_1970;
}

function fromJulian(julian: number): Date {
  return new Date((julian + 0.5 - JULIAN_1970) * MS_PER_DAY);
}

function solarMeanAnomaly(days: number): number {
  return DEG * (357.5291 + 0.98560028 * days);
}

function eclipticLongitude(meanAnomaly: number): number {
  const center =
    DEG * (1.9148 * Math.sin(meanAnomaly) + 0.02 * Math.sin(2 * meanAnomaly) + 0.0003 * Math.sin(3 * meanAnomaly));
  const perihelion = DEG * 102.9372;
  return meanAnomaly + center + perihelion + Math.PI;
}

/** Déclinaison solaire en radians. */
export function solarDeclination(date: Date): number {
  const days = toJulian(date) - J2000;
  const longitude = eclipticLongitude(solarMeanAnomaly(days));
  const obliquity = DEG * 23.4397;
  return Math.asin(Math.sin(obliquity) * Math.sin(longitude));
}

/**
 * Instant où le Soleil atteint une altitude donnée, en montant (`rising`) ou
 * en descendant. Renvoie `null` si l'altitude n'est jamais atteinte ce jour-là
 * (nuit ou jour polaire) : on préfère l'absence de valeur à une valeur inventée.
 */
function timeAtAltitude(
  date: Date,
  latitude: number,
  longitude: number,
  altitudeDeg: number,
  rising: boolean,
): Date | null {
  const days = Math.round(toJulian(date) - J2000 - 0.0009 - -longitude / 360);
  const approxTransit = 0.0009 + -longitude / 360 + days;

  const meanAnomaly = solarMeanAnomaly(approxTransit);
  const longitudeSun = eclipticLongitude(meanAnomaly);
  const declination = Math.asin(Math.sin(DEG * 23.4397) * Math.sin(longitudeSun));

  const solarTransit =
    J2000 + approxTransit + 0.0053 * Math.sin(meanAnomaly) - 0.0069 * Math.sin(2 * longitudeSun);

  const latRad = latitude * DEG;
  const cosHourAngle =
    (Math.sin(altitudeDeg * DEG) - Math.sin(latRad) * Math.sin(declination)) /
    (Math.cos(latRad) * Math.cos(declination));

  if (cosHourAngle > 1 || cosHourAngle < -1) return null;

  const hourAngle = Math.acos(cosHourAngle);
  const setting = J2000 + (0.0009 + (hourAngle / (2 * Math.PI) + -longitude / 360) + days)
    + 0.0053 * Math.sin(meanAnomaly) - 0.0069 * Math.sin(2 * longitudeSun);

  return fromJulian(rising ? solarTransit - (setting - solarTransit) : setting);
}

export interface SunTimes {
  /** Début de l'aube civile (Soleil à -6°). */
  dawn: Date | null;
  sunrise: Date | null;
  sunset: Date | null;
  /** Fin du crépuscule civil (Soleil à -6°). */
  dusk: Date | null;
}

export function sunTimes(date: Date, latitude: number, longitude: number): SunTimes {
  return {
    dawn: timeAtAltitude(date, latitude, longitude, -6, true),
    sunrise: timeAtAltitude(date, latitude, longitude, -0.833, true),
    sunset: timeAtAltitude(date, latitude, longitude, -0.833, false),
    dusk: timeAtAltitude(date, latitude, longitude, -6, false),
  };
}

export type LightPhaseName = 'dawn' | 'day' | 'dusk' | 'night';

/**
 * Phase lumineuse d'un instant donné.
 * L'aube et le crépuscule sont élargis à ±45 min autour du lever/coucher :
 * c'est la fenêtre que le pêcheur vise réellement, pas l'instant astronomique.
 */
export function lightPhaseAt(instant: Date, times: SunTimes): LightPhaseName {
  const { sunrise, sunset, dawn, dusk } = times;
  if (!sunrise || !sunset) return 'night';

  const t = instant.getTime();
  const window = 45 * 60 * 1000;

  if (Math.abs(t - sunrise.getTime()) <= window) return 'dawn';
  if (Math.abs(t - sunset.getTime()) <= window) return 'dusk';
  if (dawn && t >= dawn.getTime() && t < sunrise.getTime()) return 'dawn';
  if (dusk && t > sunset.getTime() && t <= dusk.getTime()) return 'dusk';
  if (t > sunrise.getTime() && t < sunset.getTime()) return 'day';
  return 'night';
}
