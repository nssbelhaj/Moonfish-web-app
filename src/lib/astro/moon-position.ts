/**
 * Position de la Lune — séries périodiques de Meeus, chapitre 47.
 *
 * Ce module remplace le modèle moyen qui servait jusqu'ici (« la Lune retarde
 * de 50,5 min par jour »). Ce modèle plaçait le passage au méridien à ±20 min,
 * ce qui suffisait à pondérer un facteur du score mais interdisait d'AFFICHER
 * un horaire : un lever de Lune faux de vingt minutes est un horaire faux.
 *
 * Les tables ci-dessous sont l'abrégé de la théorie ELP-2000/82 publié par
 * Meeus (Astronomical Algorithms, 2ᵉ édition, tables 47.A et 47.B) : 60 termes
 * pour la longitude et la distance, 60 pour la latitude. Précision annoncée par
 * l'auteur : environ 10″ en longitude et 4″ en latitude, soit moins d'une
 * minute d'écart sur un lever.
 *
 * La vérification est faite sur l'exemple 47.a de l'ouvrage, dont les trois
 * résultats sont publiés au millionième de degré — c'est ce contrôle, et non
 * une relecture des tables, qui garantit qu'aucun coefficient n'a été mal
 * recopié (`src/lib/astro/__tests__/moon-position.test.ts`).
 */

const DEG = Math.PI / 180;
const MS_PER_DAY = 86_400_000;
const JULIAN_1970 = 2_440_588;
const J2000 = 2_451_545;

/** Rayon équatorial terrestre, en km — sert à la parallaxe horizontale. */
const EARTH_RADIUS_KM = 6378.14;

export function julianDay(date: Date): number {
  return date.getTime() / MS_PER_DAY - 0.5 + JULIAN_1970;
}

export function julianCenturies(date: Date): number {
  return (julianDay(date) - J2000) / 36_525;
}

function sin(deg: number): number {
  return Math.sin(deg * DEG);
}

function cos(deg: number): number {
  return Math.cos(deg * DEG);
}

/** Ramène un angle dans [0, 360). */
export function normalizeDeg(deg: number): number {
  const wrapped = deg % 360;
  return wrapped < 0 ? wrapped + 360 : wrapped;
}

/**
 * Table 47.A — arguments (D, M, M′, F) puis coefficients de Σl (10⁻⁶ degré)
 * et de Σr (10⁻³ km). Un même terme sert aux deux séries.
 */
const LONGITUDE_DISTANCE_TERMS: readonly (readonly [number, number, number, number, number, number])[] = [
  [0, 0, 1, 0, 6_288_774, -20_905_355],
  [2, 0, -1, 0, 1_274_027, -3_699_111],
  [2, 0, 0, 0, 658_314, -2_955_968],
  [0, 0, 2, 0, 213_618, -569_925],
  [0, 1, 0, 0, -185_116, 48_888],
  [0, 0, 0, 2, -114_332, -3_149],
  [2, 0, -2, 0, 58_793, 246_158],
  [2, -1, -1, 0, 57_066, -152_138],
  [2, 0, 1, 0, 53_322, -170_733],
  [2, -1, 0, 0, 45_758, -204_586],
  [0, 1, -1, 0, -40_923, -129_620],
  [1, 0, 0, 0, -34_720, 108_743],
  [0, 1, 1, 0, -30_383, 104_755],
  [2, 0, 0, -2, 15_327, 10_321],
  [0, 0, 1, 2, -12_528, 0],
  [0, 0, 1, -2, 10_980, 79_661],
  [4, 0, -1, 0, 10_675, -34_782],
  [0, 0, 3, 0, 10_034, -23_210],
  [4, 0, -2, 0, 8_548, -21_636],
  [2, 1, -1, 0, -7_888, 24_208],
  [2, 1, 0, 0, -6_766, 30_824],
  [1, 0, -1, 0, -5_163, -8_379],
  [1, 1, 0, 0, 4_987, -16_675],
  [2, -1, 1, 0, 4_036, -12_831],
  [2, 0, 2, 0, 3_994, -10_445],
  [4, 0, 0, 0, 3_861, -11_650],
  [2, 0, -3, 0, 3_665, 14_403],
  [0, 1, -2, 0, -2_689, -7_003],
  [2, 0, -1, 2, -2_602, 0],
  [2, -1, -2, 0, 2_390, 10_056],
  [1, 0, 1, 0, -2_348, 6_322],
  [2, -2, 0, 0, 2_236, -9_884],
  [0, 1, 2, 0, -2_120, 5_751],
  [0, 2, 0, 0, -2_069, 0],
  [2, -2, -1, 0, 2_048, -4_950],
  [2, 0, 1, -2, -1_773, 4_130],
  [2, 0, 0, 2, -1_595, 0],
  [4, -1, -1, 0, 1_215, -3_958],
  [0, 0, 2, 2, -1_110, 0],
  [3, 0, -1, 0, -892, 3_258],
  [2, 1, 1, 0, -810, 2_616],
  [4, -1, -2, 0, 759, -1_897],
  [0, 2, -1, 0, -713, -2_117],
  [2, 2, -1, 0, -700, 2_354],
  [2, 1, -2, 0, 691, 0],
  [2, -1, 0, -2, 596, 0],
  [4, 0, 1, 0, 549, -1_423],
  [0, 0, 4, 0, 537, -1_117],
  [4, -1, 0, 0, 520, -1_571],
  [1, 0, -2, 0, -487, -1_739],
  [2, 1, 0, -2, -399, 0],
  [0, 0, 2, -2, -381, -4_421],
  [1, 1, 1, 0, 351, 0],
  [3, 0, -2, 0, -340, 0],
  [4, 0, -3, 0, 330, 0],
  [2, -1, 2, 0, 327, 0],
  [0, 2, 1, 0, -323, 1_165],
  [1, 1, -1, 0, 299, 0],
  [2, 0, 3, 0, 294, 0],
  [2, 0, -1, -2, 0, 8_752],
];

/** Table 47.B — arguments puis coefficient de Σb (10⁻⁶ degré). */
const LATITUDE_TERMS: readonly (readonly [number, number, number, number, number])[] = [
  [0, 0, 0, 1, 5_128_122],
  [0, 0, 1, 1, 280_602],
  [0, 0, 1, -1, 277_693],
  [2, 0, 0, -1, 173_237],
  [2, 0, -1, 1, 55_413],
  [2, 0, -1, -1, 46_271],
  [2, 0, 0, 1, 32_573],
  [0, 0, 2, 1, 17_198],
  [2, 0, 1, -1, 9_266],
  [0, 0, 2, -1, 8_822],
  [2, -1, 0, -1, 8_216],
  [2, 0, -2, -1, 4_324],
  [2, 0, 1, 1, 4_200],
  [2, 1, 0, -1, -3_359],
  [2, -1, -1, 1, 2_463],
  [2, -1, 0, 1, 2_211],
  [2, -1, -1, -1, 2_065],
  [0, 1, -1, -1, -1_870],
  [4, 0, -1, -1, 1_828],
  [0, 1, 0, 1, -1_794],
  [0, 0, 0, 3, -1_749],
  [0, 1, -1, 1, -1_565],
  [1, 0, 0, 1, -1_491],
  [0, 1, 1, 1, -1_475],
  [0, 1, 1, -1, -1_410],
  [0, 1, 0, -1, -1_344],
  [1, 0, 0, -1, -1_335],
  [0, 0, 3, 1, 1_107],
  [4, 0, 0, -1, 1_021],
  [4, 0, -1, 1, 833],
  [0, 0, 1, -3, 777],
  [4, 0, -2, 1, 671],
  [2, 0, 0, -3, 607],
  [2, 0, 2, -1, 596],
  [2, -1, 1, -1, 491],
  [2, 0, -2, 1, -451],
  [0, 0, 3, -1, 439],
  [2, 0, 2, 1, 422],
  [2, 0, -3, -1, 421],
  [2, 1, -1, 1, -366],
  [2, 1, 0, 1, -351],
  [4, 0, 0, 1, 331],
  [2, -1, 1, 1, 315],
  [2, -2, 0, -1, 302],
  [0, 0, 1, 3, -283],
  [2, 1, 1, -1, -229],
  [1, 1, 0, -1, 223],
  [1, 1, 0, 1, 223],
  [0, 1, -2, -1, -220],
  [2, 1, -1, -1, -220],
  [1, 0, 1, 1, -185],
  [2, -1, -2, -1, 181],
  [0, 1, 2, 1, -177],
  [4, 0, -2, -1, 176],
  [4, -1, -1, -1, 166],
  [1, 0, 1, -1, -164],
  [4, 0, 1, -1, 132],
  [1, 0, -1, -1, -119],
  [4, -1, 0, -1, 115],
  [2, -2, 0, 1, 107],
];

export interface MoonEcliptic {
  /** Longitude écliptique apparente, en degrés. */
  longitudeDeg: number;
  /** Latitude écliptique, en degrés. */
  latitudeDeg: number;
  /** Distance Terre–Lune, centre à centre, en kilomètres. */
  distanceKm: number;
  /** Parallaxe horizontale équatoriale, en degrés. */
  parallaxDeg: number;
}

/**
 * Coordonnées écliptiques géocentriques de la Lune.
 *
 * L'excentricité de l'orbite terrestre varie lentement : Meeus impose de
 * multiplier par `E` les termes où l'anomalie solaire M intervient une fois, et
 * par `E²` ceux où elle intervient deux fois. Omettre cette correction fait une
 * erreur de quelques secondes d'arc aujourd'hui, mais bien davantage sur des
 * dates éloignées — et elle ne coûte rien.
 */
export function moonEcliptic(date: Date): MoonEcliptic {
  const t = julianCenturies(date);

  const lPrime =
    218.3164477 + 481_267.88123421 * t - 0.0015786 * t * t + (t * t * t) / 538_841 - (t * t * t * t) / 65_194_000;
  const d =
    297.8501921 + 445_267.1114034 * t - 0.0018819 * t * t + (t * t * t) / 545_868 - (t * t * t * t) / 113_065_000;
  const m = 357.5291092 + 35_999.0502909 * t - 0.0001536 * t * t + (t * t * t) / 24_490_000;
  const mPrime =
    134.9633964 + 477_198.8675055 * t + 0.0087414 * t * t + (t * t * t) / 69_699 - (t * t * t * t) / 14_712_000;
  const f =
    93.272095 + 483_202.0175233 * t - 0.0036539 * t * t - (t * t * t) / 3_526_000 + (t * t * t * t) / 863_310_000;

  const a1 = 119.75 + 131.849 * t;
  const a2 = 53.09 + 479_264.29 * t;
  const a3 = 313.45 + 481_266.484 * t;
  const e = 1 - 0.002516 * t - 0.0000074 * t * t;

  let sumL = 0;
  let sumR = 0;
  for (const [cd, cm, cmp, cf, coefL, coefR] of LONGITUDE_DISTANCE_TERMS) {
    const argument = cd * d + cm * m + cmp * mPrime + cf * f;
    const eccentricity = cm === 0 ? 1 : cm === 1 || cm === -1 ? e : e * e;
    sumL += coefL * eccentricity * sin(argument);
    sumR += coefR * eccentricity * cos(argument);
  }

  let sumB = 0;
  for (const [cd, cm, cmp, cf, coefB] of LATITUDE_TERMS) {
    const argument = cd * d + cm * m + cmp * mPrime + cf * f;
    const eccentricity = cm === 0 ? 1 : cm === 1 || cm === -1 ? e : e * e;
    sumB += coefB * eccentricity * sin(argument);
  }

  // Termes additifs de Vénus, Jupiter et de l'aplatissement de la Terre.
  sumL += 3958 * sin(a1) + 1962 * sin(lPrime - f) + 318 * sin(a2);
  sumB +=
    -2235 * sin(lPrime) +
    382 * sin(a3) +
    175 * sin(a1 - f) +
    175 * sin(a1 + f) +
    127 * sin(lPrime - mPrime) -
    115 * sin(lPrime + mPrime);

  const distanceKm = 385_000.56 + sumR / 1000;

  return {
    longitudeDeg: normalizeDeg(lPrime + sumL / 1_000_000),
    latitudeDeg: sumB / 1_000_000,
    distanceKm,
    parallaxDeg: Math.asin(EARTH_RADIUS_KM / distanceKm) / DEG,
  };
}

/** Obliquité moyenne de l'écliptique, en degrés (Laskar, terme principal). */
export function meanObliquityDeg(date: Date): number {
  const t = julianCenturies(date);
  return 23.439291 - 0.0130042 * t - 0.00000016 * t * t + 0.000000504 * t * t * t;
}

export interface Equatorial {
  /** Ascension droite, en degrés. */
  raDeg: number;
  /** Déclinaison, en degrés. */
  decDeg: number;
  distanceKm: number;
  parallaxDeg: number;
}

export function moonEquatorial(date: Date): Equatorial {
  const { longitudeDeg, latitudeDeg, distanceKm, parallaxDeg } = moonEcliptic(date);
  const obliquity = meanObliquityDeg(date);

  const ra = Math.atan2(
    sin(longitudeDeg) * cos(obliquity) - Math.tan(latitudeDeg * DEG) * sin(obliquity),
    cos(longitudeDeg),
  );
  const dec = Math.asin(
    sin(latitudeDeg) * cos(obliquity) + cos(latitudeDeg) * sin(obliquity) * sin(longitudeDeg),
  );

  return { raDeg: normalizeDeg(ra / DEG), decDeg: dec / DEG, distanceKm, parallaxDeg };
}

/**
 * Temps sidéral apparent à Greenwich, en degrés (Meeus 12.4, sans nutation).
 * L'écart dû à la nutation atteint 1,1″ : négligeable devant la minute d'horloge
 * que nous affichons.
 */
export function greenwichSiderealDeg(date: Date): number {
  const jd = julianDay(date);
  const t = (jd - J2000) / 36_525;
  return normalizeDeg(
    280.46061837 + 360.98564736629 * (jd - J2000) + 0.000387933 * t * t - (t * t * t) / 38_710_000,
  );
}

export interface MoonHorizontal {
  /** Hauteur du centre au-dessus de l'horizon, vue du sol, en degrés. */
  altitudeDeg: number;
  /** Angle horaire, en degrés, ramené dans [-180, 180[. */
  hourAngleDeg: number;
  /** Parallaxe horizontale équatoriale, en degrés. */
  parallaxDeg: number;
}

/**
 * Hauteur et angle horaire de la Lune, vus du sol, en une seule évaluation.
 *
 * Les trois grandeurs sortent des mêmes cent vingt termes périodiques : les
 * demander séparément, comme le faisaient `moonAltitudeDeg` et
 * `moonHourAngleDeg` appelés à la suite, triplait le coût du balayage qui
 * cherche un lever. Le calcul des éphémérides pèse alors plus que tout le reste
 * du rendu.
 *
 * Deux corrections que le Soleil ne demande pas :
 *
 * — la PARALLAXE. La Lune est proche : un observateur à la surface la voit
 *   jusqu'à 1° plus bas qu'un observateur au centre de la Terre. Ignorer ce
 *   terme décale un lever de plusieurs dizaines de minutes.
 * — la RÉFRACTION, appliquée par le seuil de lever, dans `moon.ts`.
 */
export function moonHorizontal(date: Date, latitude: number, longitude: number): MoonHorizontal {
  const { raDeg, decDeg, parallaxDeg } = moonEquatorial(date);

  const rawHourAngle = normalizeDeg(greenwichSiderealDeg(date) + longitude - raDeg);
  const hourAngleDeg = rawHourAngle >= 180 ? rawHourAngle - 360 : rawHourAngle;

  const geocentric =
    Math.asin(sin(latitude) * sin(decDeg) + cos(latitude) * cos(decDeg) * cos(hourAngleDeg)) / DEG;

  // Parallaxe : la correction exacte demanderait les coordonnées topocentriques
  // complètes. Ce premier ordre suffit — l'erreur résiduelle est de l'ordre de
  // la seconde d'arc, très en deçà de la minute que nous affichons.
  return {
    altitudeDeg: geocentric - parallaxDeg * cos(geocentric),
    hourAngleDeg,
    parallaxDeg,
  };
}

/** Hauteur de la Lune au-dessus de l'horizon, en degrés, vue du sol. */
export function moonAltitudeDeg(date: Date, latitude: number, longitude: number): number {
  return moonHorizontal(date, latitude, longitude).altitudeDeg;
}

/** Angle horaire de la Lune, en degrés, ramené dans [-180, 180[. */
export function moonHourAngleDeg(date: Date, longitude: number): number {
  return moonHorizontal(date, 0, longitude).hourAngleDeg;
}
