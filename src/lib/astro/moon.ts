/**
 * Lune : phase réelle, lever, coucher, passages au méridien.
 *
 * Tout ici est CALCULÉ à partir de la position lunaire (`moon-position.ts`),
 * plus rien n'est moyenné. Ce que cela change :
 *
 * — la phase vient de l'élongation vraie Soleil–Lune, pas d'un compteur de
 *   jours depuis une nouvelle lune de référence. L'écart entre les deux atteint
 *   quatorze heures, parce que la Lune accélère et ralentit sur son orbite ;
 * — le lever et le coucher sont de vrais instants, cherchés par balayage de la
 *   hauteur puis dichotomie. Ils dépendent de la LATITUDE, ce que l'ancien
 *   modèle ignorait : il les posait à ±6 h 12 du passage au méridien, ce qui
 *   n'est exact qu'à l'équateur et à l'équinoxe ;
 * — les périodes solunaires majeures sont les passages au méridien, supérieur
 *   et inférieur, calculés par l'angle horaire plutôt que par un retard moyen
 *   de 24 h 50.
 */

import { julianCenturies, moonEcliptic, moonHorizontal, normalizeDeg } from './moon-position';

/** Durée moyenne d'une lunaison, en jours. */
export const SYNODIC_MONTH_D = 29.530588;

const DEG = Math.PI / 180;
const AU_KM = 149_597_870.7;

/**
 * Longitude apparente et rayon vecteur du Soleil (Meeus 25, précision réduite :
 * 0,01° en longitude). Nécessaires à la phase, qui est une géométrie à trois
 * corps et non une fonction du calendrier.
 */
function sunApparent(date: Date): { longitudeDeg: number; distanceKm: number } {
  const t = julianCenturies(date);
  const l0 = 280.46646 + 36_000.76983 * t + 0.0003032 * t * t;
  const m = 357.52911 + 35_999.05029 * t - 0.0001537 * t * t;
  const center =
    (1.914602 - 0.004817 * t - 0.000014 * t * t) * Math.sin(m * DEG) +
    (0.019993 - 0.000101 * t) * Math.sin(2 * m * DEG) +
    0.000289 * Math.sin(3 * m * DEG);

  const trueAnomaly = m + center;
  const e = 0.016708634 - 0.000042037 * t - 0.0000001267 * t * t;
  const radiusAu = (1.000001018 * (1 - e * e)) / (1 + e * Math.cos(trueAnomaly * DEG));

  return { longitudeDeg: normalizeDeg(l0 + center), distanceKm: radiusAu * AU_KM };
}

export interface MoonPhase {
  /** Âge de la lunaison en jours, déduit de l'élongation vraie. */
  ageDays: number;
  /** Fraction éclairée du disque, 0–100. */
  illuminationPct: number;
  /** Élongation géocentrique Soleil–Lune, en degrés (0 = nouvelle, 180 = pleine). */
  elongationDeg: number;
  /** Vrai entre la nouvelle et la pleine lune. */
  waxing: boolean;
}

/**
 * Phase de la Lune à un instant donné.
 *
 * La fraction éclairée se calcule sur l'angle de phase Soleil–Lune–Terre, qui
 * tient compte des deux distances : c'est la formule 48.1 de Meeus. La
 * différence avec le modèle sinusoïdal précédent atteint deux points de
 * pourcentage, et jusqu'à quatorze heures sur la date des syzygies.
 */
export function moonPhase(date: Date): MoonPhase {
  const moon = moonEcliptic(date);
  const sun = sunApparent(date);

  const elongation =
    Math.acos(
      Math.cos(moon.latitudeDeg * DEG) * Math.cos((moon.longitudeDeg - sun.longitudeDeg) * DEG),
    ) / DEG;

  const phaseAngle =
    Math.atan2(
      sun.distanceKm * Math.sin(elongation * DEG),
      moon.distanceKm - sun.distanceKm * Math.cos(elongation * DEG),
    ) / DEG;

  // L'âge suit la différence de longitude, seule grandeur qui distingue le
  // croissant montant du descendant — l'élongation seule, elle, est symétrique.
  const longitudeGap = normalizeDeg(moon.longitudeDeg - sun.longitudeDeg);

  return {
    ageDays: (longitudeGap / 360) * SYNODIC_MONTH_D,
    illuminationPct: ((1 + Math.cos(phaseAngle * DEG)) / 2) * 100,
    elongationDeg: elongation,
    waxing: longitudeGap < 180,
  };
}

/** Âge de la lunaison en jours, dans [0, 29.53). */
export function moonAgeDays(date: Date): number {
  return moonPhase(date).ageDays;
}

/** Fraction éclairée du disque, 0–100. */
export function moonIlluminationPct(date: Date): number {
  return moonPhase(date).illuminationPct;
}

/**
 * Hauteur du centre de la Lune au moment du lever et du coucher.
 *
 * Convention des éphémérides : le BORD SUPÉRIEUR affleure l'horizon, réfraction
 * comprise. Le centre est donc sous l'horizon d'un demi-diamètre (0,2725 × la
 * parallaxe) plus les 34′ de réfraction. Un service qui prendrait le centre du
 * disque plutôt que le bord trouverait environ une minute d'écart — l'ordre de
 * grandeur du désaccord entre annuaires, et la raison pour laquelle nous
 * n'affichons pas la seconde.
 */
const REFRACTION_DEG = 34 / 60;
const SEMIDIAMETER_RATIO = 0.2725;

/**
 * Écart à l'horizon de lever : positif quand la Lune est levée.
 *
 * L'angle horaire sort du même calcul, sans un terme de plus : le balayage
 * cherche à la fois les levers et les passages au méridien.
 */
function horizonState(
  date: Date,
  latitude: number,
  longitude: number,
): { elevation: number; hourAngleDeg: number } {
  const { altitudeDeg, hourAngleDeg, parallaxDeg } = moonHorizontal(date, latitude, longitude);
  return {
    elevation: altitudeDeg + REFRACTION_DEG + SEMIDIAMETER_RATIO * parallaxDeg,
    hourAngleDeg,
  };
}

/**
 * Pas de balayage. La Lune monte au plus vite d'environ 15°/h : à vingt
 * minutes, aucun passage au-dessus de l'horizon ne peut se glisser entre deux
 * échantillons sous nos latitudes. Un pas d'une heure, lui, en manquerait aux
 * abords du cercle polaire.
 */
const SCAN_STEP_MIN = 20;

/** Précision de la dichotomie : la seconde, très en deçà de la minute affichée. */
const REFINE_S = 1;

function bisect(from: Date, to: Date, fn: (d: Date) => number): Date {
  let low = from.getTime();
  let high = to.getTime();
  const lowSign = Math.sign(fn(new Date(low)));

  while (high - low > REFINE_S * 1000) {
    const middle = (low + high) / 2;
    if (Math.sign(fn(new Date(middle))) === lowSign) low = middle;
    else high = middle;
  }

  return new Date(Math.round((low + high) / 2));
}

export interface MoonTimes {
  rise: Date | null;
  set: Date | null;
  /** Passage au méridien supérieur : la Lune est au plus haut. */
  transit: Date | null;
  /** Passage au méridien inférieur, sous nos pieds. */
  nadir: Date | null;
  /** La Lune ne s'est pas couchée de la fenêtre. */
  alwaysUp: boolean;
  /** La Lune ne s'est pas levée de la fenêtre. */
  alwaysDown: boolean;
}

/**
 * Lever, coucher et passages au méridien sur une fenêtre commençant à
 * `from` (typiquement minuit LOCAL, converti en instant UTC).
 *
 * Un jour civil peut ne contenir aucun lever, ou aucun coucher : la Lune se
 * lève environ cinquante minutes plus tard chaque jour, si bien qu'elle saute
 * une case tous les quinze jours environ. Le champ vaut alors `null`, et
 * l'interface doit écrire « pas de lever aujourd'hui » plutôt qu'un tiret muet.
 */
/**
 * Mémoïsation des journées déjà calculées.
 *
 * La recherche d'un lever coûte une centaine d'évaluations des séries
 * périodiques, et les cinq pages d'un spot reconstruisent chacune la même
 * prévision : sans ce cache, la même journée lunaire était calculée cinq fois.
 * La fonction est pure et la clé contient tous ses arguments — ce n'est pas un
 * cache de données, qui pourrait se périmer, mais un souvenir de calcul.
 */
const TIMES_CACHE = new Map<string, MoonTimes>();
const TIMES_CACHE_MAX = 512;

export function moonTimes(
  from: Date,
  latitude: number,
  longitude: number,
  hours = 24,
): MoonTimes {
  const key = `${from.getTime()}|${latitude}|${longitude}|${hours}`;
  const remembered = TIMES_CACHE.get(key);
  if (remembered) return remembered;

  const computed = computeMoonTimes(from, latitude, longitude, hours);

  // Éviction du plus ancien : la borne suffit largement à une prévision de sept
  // jours sur douze spots, et empêche la carte de croître sans fin dans un
  // processus de longue durée.
  if (TIMES_CACHE.size >= TIMES_CACHE_MAX) {
    const oldest = TIMES_CACHE.keys().next();
    if (!oldest.done) TIMES_CACHE.delete(oldest.value);
  }
  TIMES_CACHE.set(key, computed);

  return computed;
}

function computeMoonTimes(
  from: Date,
  latitude: number,
  longitude: number,
  hours: number,
): MoonTimes {
  const startMs = from.getTime();
  const stepMs = SCAN_STEP_MIN * 60_000;
  const steps = Math.ceil((hours * 3_600_000) / stepMs);

  let rise: Date | null = null;
  let set: Date | null = null;
  let transit: Date | null = null;
  let nadir: Date | null = null;

  const elevationAt = (d: Date): number => horizonState(d, latitude, longitude).elevation;
  const hourAngleAt = (d: Date): number => horizonState(d, latitude, longitude).hourAngleDeg;

  let previous = new Date(startMs);
  let state = horizonState(previous, latitude, longitude);
  let everUp = state.elevation > 0;
  let everDown = state.elevation <= 0;

  for (let step = 1; step <= steps; step += 1) {
    const current = new Date(startMs + step * stepMs);
    const next = horizonState(current, latitude, longitude);

    if (next.elevation > 0) everUp = true;
    else everDown = true;

    if (state.elevation <= 0 && next.elevation > 0 && rise === null) {
      rise = bisect(previous, current, elevationAt);
    }
    if (state.elevation > 0 && next.elevation <= 0 && set === null) {
      set = bisect(previous, current, elevationAt);
    }

    // L'angle horaire croît sans cesse d'environ 14,5°/h. Son passage par zéro
    // est le méridien supérieur ; le saut de +180 à −180 est l'inférieur.
    if (state.hourAngleDeg < 0 && next.hourAngleDeg >= 0 && transit === null) {
      transit = bisect(previous, current, hourAngleAt);
    }
    if (state.hourAngleDeg > next.hourAngleDeg && nadir === null) {
      // Décalage de 180° : la fonction devient continue et strictement
      // croissante là où l'angle horaire, lui, saute de +180 à −180. Chercher le
      // zéro d'une fonction discontinue donnerait n'importe quel instant.
      nadir = bisect(previous, current, (d) => normalizeDeg(hourAngleAt(d)) - 180);
    }

    previous = current;
    state = next;
  }

  return {
    rise,
    set,
    transit,
    nadir,
    alwaysUp: !everDown,
    alwaysDown: !everUp,
  };
}

export interface SolunarPeriods {
  /** Passages au méridien (supérieur et inférieur) — périodes majeures. */
  major: Date[];
  /** Levers et couchers de Lune — périodes mineures. */
  minor: Date[];
}

/**
 * Périodes solunaires d'une journée, bornes comprises.
 *
 * La fenêtre couvre soixante-douze heures centrées sur le jour : un créneau de
 * minuit à deux heures est souvent plus proche d'un passage de la veille que de
 * n'importe quel instant du jour même. Ne balayer que la journée ferait
 * apparaître, chaque nuit, une distance artificiellement grande à la période la
 * plus proche — et un score qui s'effondre au changement de date.
 */
export function solunarPeriods(dayStart: Date, latitude: number, longitude: number): SolunarPeriods {
  return periodsFrom(
    [-1, 0, 1].map((dayOffset) =>
      moonTimes(new Date(dayStart.getTime() + dayOffset * 86_400_000), latitude, longitude),
    ),
  );
}

/**
 * Assemble les périodes à partir de journées DÉJÀ calculées.
 *
 * `buildForecastDays` a besoin de trois journées par jour affiché, et les
 * journées se recouvrent d'un jour à l'autre : passer par cette fonction évite
 * de recalculer trois fois la même position lunaire, soit les deux tiers du
 * travail astronomique d'un build.
 */
export function periodsFrom(days: readonly MoonTimes[]): SolunarPeriods {
  const major: Date[] = [];
  const minor: Date[] = [];

  for (const times of days) {
    for (const moment of [times.transit, times.nadir]) if (moment) major.push(moment);
    for (const moment of [times.rise, times.set]) if (moment) minor.push(moment);
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
