import { describe, expect, it } from 'vitest';
import { computeScore } from '../compute';
import { classifyWind, scoreWind } from '../factors/wind';
import { scoreSwell } from '../factors/swell';
import { withInput } from './fixtures';

// Le spot de référence regarde plein ouest (270°).
const FACING = 270;

describe('vent — orientation', () => {
  it('qualifie le vent depuis le cap du spot, pas en degrés absolus', () => {
    expect(classifyWind(270, FACING)).toBe('mer');
    expect(classifyWind(90, FACING)).toBe('terre');
    expect(classifyWind(180, FACING)).toBe('travers');
  });

  it('classe correctement de part et d’autre du passage par 0°', () => {
    expect(classifyWind(350, 10)).toBe('mer');
    expect(classifyWind(190, 10)).toBe('terre');
  });

  it('note le secteur mer 10–25 km/h au-dessus du vent de terre équivalent', () => {
    const onshore = scoreWind({ speedKmh: 16, fromDeg: 270 }, FACING).score;
    const offshore = scoreWind({ speedKmh: 16, fromDeg: 90 }, FACING).score;
    expect(onshore).toBeGreaterThanOrEqual(9);
    expect(offshore).toBeLessThan(onshore);
    // « Vent de terre modéré = correct » : dégradé, pas éliminatoire.
    expect(offshore).toBeGreaterThan(3.5);
  });
});

describe('vent — vent fort', () => {
  it('plafonne le score au-delà de 40 km/h quelle que soit l’orientation', () => {
    for (const fromDeg of [270, 180, 90]) {
      expect(scoreWind({ speedKmh: 46, fromDeg }, FACING).score).toBeLessThanOrEqual(2.4);
    }
  });

  it('effondre le score au-delà du seuil de danger de 50 km/h', () => {
    expect(scoreWind({ speedKmh: 56, fromDeg: 270 }, FACING).score).toBeLessThanOrEqual(0.8);
  });

  it('fait basculer un créneau par ailleurs parfait sous le palier Bon', () => {
    const windy = computeScore(withInput({ wind: { speedKmh: 47, fromDeg: 270 } }));
    expect(windy.value).toBeLessThan(8);
    expect(windy.safety.level).toBe('prudence');
  });
});

describe('houle — plages', () => {
  it('note au maximum 0,5–1,5 m', () => {
    for (const heightM of [0.6, 1, 1.4]) {
      expect(scoreSwell({ heightM, periodS: 10 }).score).toBeGreaterThanOrEqual(9);
    }
  });

  it('pénalise une mer trop calme sous 0,3 m sans la mettre à zéro', () => {
    const flat = scoreSwell({ heightM: 0.15, periodS: 8 });
    expect(flat.score).toBeLessThan(4);
    expect(flat.score).toBeGreaterThan(1.5);
    expect(flat.note).toContain('trop calme');
  });

  it('pénalise une longue période moins qu’un clapot court à hauteur égale', () => {
    const long = scoreSwell({ heightM: 1.8, periodS: 11 }).score;
    const short = scoreSwell({ heightM: 1.8, periodS: 3 }).score;
    expect(long).toBeGreaterThan(short);
  });
});

describe('houle — dangereuse', () => {
  it('effondre le sous-score au-delà de 2,5 m', () => {
    expect(scoreSwell({ heightM: 2.8, periodS: 10 }).score).toBeLessThanOrEqual(1.2);
    expect(scoreSwell({ heightM: 4.5, periodS: 12 }).score).toBeLessThanOrEqual(1.2);
  });

  it('déclenche le niveau danger même si tout le reste est parfait', () => {
    const dangerous = computeScore(withInput({ swell: { heightM: 2.6, periodS: 11 } }));
    expect(dangerous.safety.level).toBe('danger');
    expect(dangerous.safety.message).toBeTruthy();
  });
});
