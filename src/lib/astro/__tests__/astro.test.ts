import { describe, expect, it } from 'vitest';
import { lightPhaseAt, sunTimes } from '../sun';
import { hoursToNearest, moonAgeDays, moonIlluminationPct, solunarPeriods } from '../moon';

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

describe('lune', () => {
  it('reste dans les bornes de la lunaison', () => {
    for (let d = 0; d < 400; d += 7) {
      const age = moonAgeDays(new Date(Date.UTC(2026, 0, 1) + d * 86_400_000));
      expect(age).toBeGreaterThanOrEqual(0);
      expect(age).toBeLessThan(29.531);
    }
  });

  it('lie l’illumination à l’âge : nulle à la nouvelle lune, pleine à mi-lunaison', () => {
    const newMoon = new Date(Date.UTC(2000, 0, 6, 18, 14));
    const fullMoon = new Date(newMoon.getTime() + 14.765 * 86_400_000);
    expect(moonIlluminationPct(newMoon)).toBeLessThan(1);
    expect(moonIlluminationPct(fullMoon)).toBeGreaterThan(99);
  });

  it('produit des périodes majeures atteignables dans la journée', () => {
    const periods = solunarPeriods(new Date('2026-06-21T00:00:00Z'), LNG);
    expect(periods.major.length).toBeGreaterThan(0);
    expect(periods.minor.length).toBeGreaterThan(0);
    expect(hoursToNearest(new Date('2026-06-21T12:00:00Z'), periods.major)).toBeLessThan(6.3);
  });
});
