import { hashString, noiseToRange, smoothNoise } from '@/lib/random';
import type { MarinePoint, Spot } from '../schemas';

const MS_PER_HOUR = 3_600_000;

/** Plus un spot est exposé, plus le vent et la houle peuvent y monter haut. */
const EXPOSURE_CEILING: Record<Spot['exposure'], { windKmh: number; swellM: number }> = {
  abrite: { windKmh: 30, swellM: 1.2 },
  'semi-abrite': { windKmh: 40, swellM: 1.9 },
  expose: { windKmh: 52, swellM: 2.8 },
  'tres-expose': { windKmh: 62, swellM: 3.6 },
};

/** Température moyenne de l'air et amplitude saisonnière, approchées par la latitude. */
function seasonalAirTemp(lat: number, date: Date, hourOfDay: number): number {
  const dayOfYear = Math.floor(
    (date.getTime() - Date.UTC(date.getUTCFullYear(), 0, 0)) / 86_400_000,
  );
  const annual = Math.cos((2 * Math.PI * (dayOfYear - 205)) / 365);
  const mean = 26 - 0.32 * Math.abs(lat);
  const amplitude = 2 + 0.11 * Math.abs(lat);
  // Cycle diurne : minimum vers 5 h, maximum vers 15 h.
  const diurnal = 3.2 * Math.cos((2 * Math.PI * (hourOfDay - 15)) / 24);
  return mean + amplitude * annual + diurnal;
}

/** L'eau suit l'air avec environ six semaines de retard et une amplitude moindre. */
function seasonalWaterTemp(lat: number, date: Date): number {
  const dayOfYear = Math.floor(
    (date.getTime() - Date.UTC(date.getUTCFullYear(), 0, 0)) / 86_400_000,
  );
  const annual = Math.cos((2 * Math.PI * (dayOfYear - 245)) / 365);
  const mean = 25 - 0.28 * Math.abs(lat);
  return mean + (1.5 + 0.06 * Math.abs(lat)) * annual;
}

/**
 * Une heure de conditions marines simulées.
 *
 * La structure de sortie est celle d'Open-Meteo Marine + Forecast une fois les
 * tableaux parallèles recomposés en objets. Le contenu, lui, est une invention
 * cohérente : bruit lisse pour que la série se tienne d'une heure à l'autre,
 * corrélation vent/houle pour que le tout reste physiquement plausible.
 */
export function marinePointAt(spot: Spot, instant: Date): MarinePoint {
  const seed = hashString(spot.slug);
  const t = instant.getTime() / MS_PER_HOUR;
  const ceiling = EXPOSURE_CEILING[spot.exposure];

  const windNoise = smoothNoise(seed ^ 0x9e37, t);
  const windSpeedKmh = Math.max(1, noiseToRange(windNoise, 2, ceiling.windKmh));

  // La direction tourne lentement autour du secteur dominant du spot.
  const directionNoise = smoothNoise(seed ^ 0x1b3f, t * 0.4);
  const windFromDeg = (spot.facingDeg + directionNoise * 150 + 360) % 360;

  // La houle suit le vent avec du retard et de l'inertie : c'est ce décalage qui
  // rend crédibles les créneaux « mer encore formée, vent déjà tombé ».
  const swellNoise = smoothNoise(seed ^ 0x77d1, t - 9);
  const windContribution = 0.45 * ((windSpeedKmh / ceiling.windKmh) * ceiling.swellM);
  const swellHeightM = Math.max(
    0.05,
    noiseToRange(swellNoise, 0.1, ceiling.swellM * 0.75) + windContribution,
  );

  const periodNoise = smoothNoise(seed ^ 0x5c21, t * 0.5);
  const swellPeriodS = noiseToRange(periodNoise, 4, 14);
  const swellFromDeg = (spot.facingDeg + smoothNoise(seed ^ 0x2a19, t * 0.3) * 45 + 360) % 360;

  const hourOfDay = instant.getUTCHours() + instant.getUTCMinutes() / 60;
  const cloudNoise = smoothNoise(seed ^ 0x4e8d, t * 0.7);
  const pressureNoise = smoothNoise(seed ^ 0x63a7, t * 0.3);

  const round = (value: number, decimals: number): number => {
    const factor = 10 ** decimals;
    return Math.round(value * factor) / factor;
  };

  return {
    time: instant.toISOString(),
    windSpeedKmh: round(windSpeedKmh, 1),
    windGustKmh: round(windSpeedKmh * (1.32 + 0.12 * windNoise), 1),
    windFromDeg: round(windFromDeg, 0),
    swellHeightM: round(swellHeightM, 2),
    swellPeriodS: round(swellPeriodS, 1),
    swellFromDeg: round(swellFromDeg, 0),
    airTempC: round(seasonalAirTemp(spot.lat, instant, hourOfDay), 1),
    waterTempC: round(seasonalWaterTemp(spot.lat, instant), 1),
    cloudCoverPct: round(noiseToRange(cloudNoise, 0, 100), 0),
    pressureHpa: round(noiseToRange(pressureNoise, 988, 1030), 0),
    // Champs de confort : dérivés du même bruit que le reste, pour rester
    // déterministes et cohérents entre eux — une couverture nuageuse à 90 %
    // avec 0 % de pluie et un UV de 8 se verrait tout de suite.
    precipitationProbabilityPct: round(noiseToRange(cloudNoise, 0, 95), 0),
    uvIndex: round(uvIndexFor(spot.lat, instant, hourOfDay, cloudNoise), 1),
    visibilityKm: round(noiseToRange(-cloudNoise, 3, 30), 1),
    apparentTempC: round(
      seasonalAirTemp(spot.lat, instant, hourOfDay) - 0.02 * windSpeedKmh,
      1,
    ),
    humidityPct: round(noiseToRange(cloudNoise, 42, 96), 0),
    dewPointC: round(seasonalAirTemp(spot.lat, instant, hourOfDay) - 8 + 4 * cloudNoise, 1),
  };
}

/**
 * Indice UV simulé.
 *
 * Nul la nuit, maximal au midi solaire, atténué par la latitude et la
 * couverture nuageuse. Il n'a aucune prétention de justesse — il sert à ce que
 * l'écran de démonstration ne montre pas un UV de 7 à trois heures du matin,
 * ce qui décrédibiliserait tout le reste de la page.
 */
function uvIndexFor(lat: number, instant: Date, hourOfDay: number, cloudNoise: number): number {
  const daylight = Math.max(0, Math.cos(((hourOfDay - 13) / 12) * Math.PI));
  const month = instant.getUTCMonth();
  const season = 0.6 + 0.4 * Math.cos(((month - 6) / 6) * Math.PI);
  const latitudeFactor = Math.max(0.25, Math.cos((Math.abs(lat) * Math.PI) / 180));
  const clouds = 1 - 0.55 * Math.max(0, cloudNoise);
  return Math.max(0, Math.min(11, 10 * daylight * season * latitudeFactor * clouds));
}

/** Série horaire couvrant [from, to[. */
export function generateMarineSeries(spot: Spot, from: Date, to: Date): MarinePoint[] {
  const points: MarinePoint[] = [];
  for (let t = from.getTime(); t < to.getTime(); t += MS_PER_HOUR) {
    points.push(marinePointAt(spot, new Date(t)));
  }
  return points;
}
