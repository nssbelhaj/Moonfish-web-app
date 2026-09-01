import { describe, expect, it } from 'vitest';
import {
  greenwichSiderealDeg,
  julianCenturies,
  julianDay,
  meanObliquityDeg,
  moonEcliptic,
  moonEquatorial,
  normalizeDeg,
} from '../moon-position';

/**
 * Ces tests ne vérifient pas « à peu près » : ils rejouent des exemples publiés,
 * chiffre par chiffre.
 *
 * C'est le seul contrôle qui vaille sur cent vingt lignes de coefficients
 * recopiés à la main. Une relecture ne détecte pas une inversion de deux
 * chiffres ; l'exemple 47.a, lui, ne tombe juste que si TOUS les grands termes
 * sont exacts, puisque chacun d'eux pèse plus que la précision demandée.
 */

describe('exemple 47.a de Meeus — 12 avril 1992 à 0 h TD', () => {
  const date = new Date('1992-04-12T00:00:00Z');

  it('retrouve le jour julien et le siècle de l’exemple', () => {
    expect(julianDay(date)).toBe(2_448_724.5);
    expect(julianCenturies(date)).toBeCloseTo(-0.077221081451, 12);
  });

  it('retrouve la longitude écliptique au millionième de degré', () => {
    expect(moonEcliptic(date).longitudeDeg).toBeCloseTo(133.162655, 6);
  });

  it('retrouve la latitude écliptique au millionième de degré', () => {
    expect(moonEcliptic(date).latitudeDeg).toBeCloseTo(-3.229126, 6);
  });

  it('retrouve la distance au dixième de kilomètre', () => {
    expect(moonEcliptic(date).distanceKm).toBeCloseTo(368_409.7, 1);
  });

  it('retrouve la parallaxe horizontale au millionième de degré', () => {
    expect(moonEcliptic(date).parallaxDeg).toBeCloseTo(0.99199, 6);
  });
});

describe('temps sidéral — exemple 12.a de Meeus', () => {
  it('retrouve le temps sidéral de Greenwich du 10 avril 1987 à 0 h UT', () => {
    // 197,693195° = 13 h 10 min 46,3668 s. Une erreur d'une seconde de temps
    // ici décalerait tous les levers de Lune d'autant.
    expect(greenwichSiderealDeg(new Date('1987-04-10T00:00:00Z'))).toBeCloseTo(197.693195, 6);
  });

  it('avance d’un tour sidéral en un jour, soit près de quatre minutes de plus qu’un tour solaire', () => {
    const start = new Date('2026-09-01T00:00:00Z');
    const next = new Date('2026-09-02T00:00:00Z');
    const advance = normalizeDeg(greenwichSiderealDeg(next) - greenwichSiderealDeg(start));
    expect(advance).toBeCloseTo(0.9856, 3);
  });
});

describe('obliquité et coordonnées équatoriales', () => {
  it('donne une obliquité qui décroît lentement', () => {
    const y2000 = meanObliquityDeg(new Date('2000-01-01T12:00:00Z'));
    const y2026 = meanObliquityDeg(new Date('2026-01-01T12:00:00Z'));
    expect(y2000).toBeCloseTo(23.4393, 3);
    expect(y2026).toBeLessThan(y2000);
    expect(y2000 - y2026).toBeLessThan(0.01);
  });

  it('garde la déclinaison lunaire dans la bande imposée par l’orbite', () => {
    // L'inclinaison de 5,1° sur l'écliptique porte la déclinaison entre ±28,7°
    // au maximum. Une valeur au-delà signalerait une erreur de conversion.
    for (let day = 0; day < 60; day += 1) {
      const { decDeg } = moonEquatorial(new Date(Date.UTC(2026, 0, 1) + day * 86_400_000));
      expect(Math.abs(decDeg)).toBeLessThan(28.8);
    }
  });

  it('parcourt les vingt-quatre heures d’ascension droite en un mois', () => {
    const values = [];
    for (let day = 0; day < 28; day += 1) {
      values.push(moonEquatorial(new Date(Date.UTC(2026, 0, 1) + day * 86_400_000)).raDeg);
    }
    expect(Math.min(...values)).toBeLessThan(30);
    expect(Math.max(...values)).toBeGreaterThan(330);
  });

  it('garde la parallaxe dans la fourchette périgée–apogée', () => {
    for (let day = 0; day < 400; day += 3) {
      const { parallaxDeg, distanceKm } = moonEcliptic(
        new Date(Date.UTC(2026, 0, 1) + day * 86_400_000),
      );
      expect(distanceKm).toBeGreaterThan(356_000);
      expect(distanceKm).toBeLessThan(407_000);
      expect(parallaxDeg).toBeGreaterThan(0.897);
      expect(parallaxDeg).toBeLessThan(1.027);
    }
  });
});
