import { describe, expect, it } from 'vitest';
import { lightPhaseAt, sunTimes } from '../sun';
import { hoursToNearest, moonPhase, moonTimes, solunarPeriods, SYNODIC_MONTH_D } from '../moon';
import { moonAltitudeDeg } from '../moon-position';

/** Lacanau, référence pour les vérifications ci-dessous. */
const LAT = 45.0;
const LNG = -1.2019;

describe('soleil — calcul NOAA', () => {
  it('place le lever et le coucher du 21 juin à Lacanau dans la bonne fenêtre', () => {
    const times = sunTimes(new Date('2026-06-21T12:00:00Z'), LAT, LNG);
    expect(times.sunrise).not.toBeNull();
    expect(times.sunset).not.toBeNull();

    const sunrise = times.sunrise as Date;
    const sunset = times.sunset as Date;
    const sunriseH = sunrise.getUTCHours() + sunrise.getUTCMinutes() / 60;
    const sunsetH = sunset.getUTCHours() + sunset.getUTCMinutes() / 60;

    // Lever attendu vers 04 h 15 UTC (06 h 15 locale), coucher vers 19 h 30 UTC.
    expect(sunriseH).toBeGreaterThan(3.8);
    expect(sunriseH).toBeLessThan(4.6);
    expect(sunsetH).toBeGreaterThan(19.2);
    expect(sunsetH).toBeLessThan(20);
  });

  it('donne une journée plus courte au solstice d’hiver qu’au solstice d’été', () => {
    const length = (iso: string): number => {
      const t = sunTimes(new Date(iso), LAT, LNG);
      return ((t.sunset as Date).getTime() - (t.sunrise as Date).getTime()) / 3_600_000;
    };

    expect(length('2026-06-21T12:00:00Z')).toBeGreaterThan(15);
    expect(length('2026-12-21T12:00:00Z')).toBeLessThan(9.5);
  });

  it('classe midi en plein jour et minuit en nuit', () => {
    const day = new Date('2026-06-21T12:00:00Z');
    const times = sunTimes(day, LAT, LNG);
    expect(lightPhaseAt(day, times)).toBe('day');
    expect(lightPhaseAt(new Date('2026-06-21T00:30:00Z'), times)).toBe('night');
  });

  it('classe l’instant du lever en aube et celui du coucher en crépuscule', () => {
    const times = sunTimes(new Date('2026-06-21T12:00:00Z'), LAT, LNG);
    expect(lightPhaseAt(times.sunrise as Date, times)).toBe('dawn');
    expect(lightPhaseAt(times.sunset as Date, times)).toBe('dusk');
  });
});

describe('phase de la Lune — élongation vraie', () => {
  it('encadre l’âge dans la lunaison', () => {
    for (let d = 0; d < 400; d += 7) {
      const { ageDays } = moonPhase(new Date(Date.UTC(2026, 0, 1) + d * 86_400_000));
      expect(ageDays).toBeGreaterThanOrEqual(0);
      expect(ageDays).toBeLessThan(SYNODIC_MONTH_D);
    }
  });

  it('retrouve la période synodique sur deux cents lunaisons', () => {
    // Contrôle de fond du modèle de phase. Sur une seule année, la moyenne des
    // écarts ne vaut PAS 29,53 j : les lunaisons vont de 29,25 à 29,71 j en
    // 2026, et les longues ne se compensent qu'au bout d'une vingtaine
    // d'années. Mesurer la moyenne sur douze mois et la comparer à la période
    // synodique serait donc un test faux — c'est l'écart entre deux nouvelles
    // lunes SÉPARÉES DE DIX-NEUF ANS qu'il faut diviser par leur nombre.
    const firstNewMoon = (after: Date): Date => {
      let previous = moonPhase(after).ageDays;
      for (let hour = 1; hour < 40 * 24; hour += 1) {
        const instant = new Date(after.getTime() + hour * 3_600_000);
        const { ageDays } = moonPhase(instant);
        if (ageDays < previous) return instant;
        previous = ageDays;
      }
      throw new Error('aucune nouvelle lune trouvée en quarante jours');
    };

    const start = firstNewMoon(new Date(Date.UTC(2020, 0, 1)));
    const end = firstNewMoon(new Date(Date.UTC(2039, 0, 1)));
    const elapsedDays = (end.getTime() - start.getTime()) / 86_400_000;
    const lunations = Math.round(elapsedDays / SYNODIC_MONTH_D);

    expect(lunations).toBeGreaterThan(200);
    expect(elapsedDays / lunations).toBeCloseTo(SYNODIC_MONTH_D, 3);
  });

  it('fait varier la durée d’une lunaison à l’autre', () => {
    // Ce que l'ancien modèle ne pouvait pas produire : il ajoutait 29,530588 j
    // à une date de référence, donc toutes ses lunaisons duraient exactement
    // pareil. Les vraies varient de plus de dix heures dans la même année.
    const newMoons: number[] = [];
    let previous = moonPhase(new Date(Date.UTC(2026, 0, 1))).ageDays;

    for (let hour = 1; hour < 365 * 24; hour += 1) {
      const instant = new Date(Date.UTC(2026, 0, 1) + hour * 3_600_000);
      const { ageDays } = moonPhase(instant);
      if (ageDays < previous) newMoons.push(instant.getTime());
      previous = ageDays;
    }

    expect(newMoons.length).toBe(12);

    const gaps = newMoons.slice(1).map((t, i) => (t - (newMoons[i] as number)) / 86_400_000);
    expect(Math.max(...gaps) - Math.min(...gaps)).toBeGreaterThan(0.4);
    for (const gap of gaps) {
      expect(gap).toBeGreaterThan(29.2);
      expect(gap).toBeLessThan(29.9);
    }
  });

  it('éteint le disque à la nouvelle lune et l’allume à la pleine', () => {
    for (let hour = 0; hour < 60 * 24; hour += 1) {
      const instant = new Date(Date.UTC(2026, 0, 1) + hour * 3_600_000);
      const { ageDays, illuminationPct, waxing } = moonPhase(instant);
      if (ageDays < 0.2) expect(illuminationPct).toBeLessThan(1);
      if (Math.abs(ageDays - SYNODIC_MONTH_D / 2) < 0.2) expect(illuminationPct).toBeGreaterThan(99);
      expect(waxing).toBe(ageDays < SYNODIC_MONTH_D / 2);
    }
  });
});

describe('lever et coucher de Lune', () => {
  const localMidnight = (day: number): Date => new Date(Date.UTC(2026, 8, day, -2, 0));

  it('place le centre de la Lune juste sous l’horizon au lever, et montant', () => {
    // Convention des éphémérides : bord supérieur affleurant, réfraction
    // comprise. Le centre est donc à environ -0,83°, jamais à 0°.
    const { rise } = moonTimes(localMidnight(1), LAT, LNG);
    expect(rise).not.toBeNull();

    const at = moonAltitudeDeg(rise as Date, LAT, LNG);
    expect(at).toBeGreaterThan(-0.9);
    expect(at).toBeLessThan(-0.75);

    const before = moonAltitudeDeg(new Date((rise as Date).getTime() - 600_000), LAT, LNG);
    const after = moonAltitudeDeg(new Date((rise as Date).getTime() + 600_000), LAT, LNG);
    expect(before).toBeLessThan(at);
    expect(after).toBeGreaterThan(at);
  });

  it('fait du passage au méridien le point le plus haut de la journée', () => {
    const { transit } = moonTimes(localMidnight(1), LAT, LNG);
    expect(transit).not.toBeNull();

    const peak = moonAltitudeDeg(transit as Date, LAT, LNG);
    for (const minutes of [-90, -30, 30, 90]) {
      expect(moonAltitudeDeg(new Date((transit as Date).getTime() + minutes * 60_000), LAT, LNG)).toBeLessThan(peak);
    }
  });

  it('retarde d’environ cinquante minutes par jour', () => {
    const transits: number[] = [];
    for (let day = 1; day <= 7; day += 1) {
      const { transit } = moonTimes(localMidnight(day), LAT, LNG);
      if (transit) transits.push(transit.getTime());
    }

    const gaps = transits.slice(1).map((t, i) => (t - (transits[i] as number)) / 60_000);
    for (const gap of gaps) {
      expect(gap).toBeGreaterThan(24 * 60 + 30);
      expect(gap).toBeLessThan(24 * 60 + 75);
    }
  });

  it('rend `null` le jour où la Lune ne se lève pas, plutôt qu’un horaire inventé', () => {
    // La Lune se lève chaque jour un peu plus tard : deux fois par mois, le
    // lever saute une journée civile entière. C'est une VALEUR ABSENTE, pas une
    // erreur, et la refuser obligerait à afficher l'heure d'un autre jour.
    let skipped = 0;
    let missingTransits = 0;
    for (let day = 1; day <= 30; day += 1) {
      const { rise, set, transit } = moonTimes(new Date(Date.UTC(2026, 8, day, -2, 0)), LAT, LNG);
      if (rise === null || set === null) skipped += 1;
      if (transit === null) missingTransits += 1;
    }

    expect(skipped).toBeGreaterThanOrEqual(1);
    // Le passage au méridien saute lui aussi une journée de temps en temps,
    // pour la même raison : il revient toutes les 24 h 50, une fenêtre civile
    // n'en dure que 24. C'est rare, et il fallait le vérifier plutôt que de le
    // supposer — les périodes solunaires d'un jour se lisent sur trois jours,
    // précisément pour que ces trous ne laissent jamais un créneau sans repère.
    expect(missingTransits).toBeLessThanOrEqual(2);
  });

  it('dépend de la latitude, ce qu’un décalage fixe autour du méridien ne pouvait pas faire', () => {
    const north = moonTimes(localMidnight(15), 55, LNG);
    const south = moonTimes(localMidnight(15), 30, LNG);

    expect(north.rise).not.toBeNull();
    expect(south.rise).not.toBeNull();

    const delta = Math.abs((north.rise as Date).getTime() - (south.rise as Date).getTime()) / 60_000;
    expect(delta).toBeGreaterThan(10);
  });

  it('ne place pas le lever et le coucher symétriquement autour du méridien', () => {
    // L'ancien modèle posait lever et coucher à ±6 h 12 du passage au méridien.
    // La déclinaison lunaire rend cette symétrie fausse partout sauf à
    // l'équinoxe et à l'équateur ; l'écart se compte en dizaines de minutes.
    const { rise, set, transit } = moonTimes(localMidnight(20), LAT, LNG);
    expect(rise).not.toBeNull();
    expect(transit).not.toBeNull();
    expect(set).not.toBeNull();

    const beforeH = ((transit as Date).getTime() - (rise as Date).getTime()) / 3_600_000;
    const afterH = ((set as Date).getTime() - (transit as Date).getTime()) / 3_600_000;
    expect(Math.abs(Math.abs(beforeH) - Math.abs(afterH))).toBeGreaterThan(0.25);
  });
});

describe('périodes solunaires', () => {
  it('couvre la journée sans trou : jamais plus de six heures à attendre', () => {
    // Les passages au méridien se suivent de 12 h 25 : depuis n'importe quel
    // instant, le plus proche est donc à moins de 6 h 13. Un écart supérieur
    // signalerait une fenêtre trop courte — le défaut qu'avait le balayage
    // limité à la seule journée en cours.
    const dayStart = new Date(Date.UTC(2026, 8, 15, -2, 0));
    const periods = solunarPeriods(dayStart, LAT, LNG);

    for (let hour = 0; hour < 24; hour += 1) {
      const instant = new Date(dayStart.getTime() + hour * 3_600_000);
      expect(hoursToNearest(instant, periods.major)).toBeLessThan(6.25);
      expect(hoursToNearest(instant, periods.minor)).toBeLessThan(13);
    }
  });

  it('donne deux passages au méridien par jour lunaire', () => {
    const periods = solunarPeriods(new Date(Date.UTC(2026, 8, 15, -2, 0)), LAT, LNG);
    // Trois journées balayées, deux passages chacune.
    expect(periods.major.length).toBe(6);
    expect(periods.minor.length).toBeGreaterThanOrEqual(4);
  });
});
