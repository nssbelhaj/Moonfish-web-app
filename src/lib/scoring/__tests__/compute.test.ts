import { describe, expect, it } from 'vitest';
import { computeScore, labelFor } from '../compute';
import { FACTOR_WEIGHTS } from '../types';
import { IDEAL, scoreOf, withInput } from './fixtures';

describe('computeScore — invariants', () => {
  it('reste borné à 0–10 avec une décimale sur des entrées extrêmes', () => {
    const extremes = [
      withInput({ swell: { heightM: 0, periodS: 0 }, wind: { speedKmh: 0, fromDeg: 0 } }),
      withInput({ swell: { heightM: 12, periodS: 20 }, wind: { speedKmh: 180, fromDeg: 90 } }),
      IDEAL,
    ];

    for (const input of extremes) {
      const value = scoreOf(input);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(10);
      expect(Number.isInteger(value * 10)).toBe(true);
    }
  });

  it('est une fonction pure : deux appels identiques rendent le même objet', () => {
    expect(computeScore(IDEAL)).toStrictEqual(computeScore(IDEAL));
  });

  it('expose un breakdown complet dont les poids somment à 1', () => {
    const { breakdown } = computeScore(IDEAL);
    const factors = ['tide', 'wind', 'swell', 'solunar', 'light'] as const;

    expect(Object.keys(breakdown).sort()).toStrictEqual([...factors].sort());
    const total = factors.reduce((sum, f) => sum + breakdown[f].weight, 0);
    expect(total).toBeCloseTo(1, 10);
    for (const f of factors) {
      expect(breakdown[f].weight).toBe(FACTOR_WEIGHTS[f]);
      expect(breakdown[f].note.length).toBeGreaterThan(0);
    }
  });

  it('accompagne toujours le score de 2 à 3 raisons (handoff §2)', () => {
    for (const input of [IDEAL, withInput({ swell: { heightM: 3.4, periodS: 6 } })]) {
      const { reasons } = computeScore(input);
      expect(reasons.length).toBeGreaterThanOrEqual(2);
      expect(reasons.length).toBeLessThanOrEqual(3);
      for (const reason of reasons) expect(reason.trim().endsWith('.')).toBe(true);
    }
  });

  it('mappe les paliers du handoff v2 sur les libellés', () => {
    expect(labelFor(0)).toBe('Médiocre');
    expect(labelFor(3.9)).toBe('Médiocre');
    expect(labelFor(4)).toBe('Passable');
    expect(labelFor(5.9)).toBe('Passable');
    expect(labelFor(6)).toBe('Bon');
    expect(labelFor(7.9)).toBe('Bon');
    expect(labelFor(8)).toBe('Excellent');
    expect(labelFor(10)).toBe('Excellent');
  });
});

describe('computeScore — le créneau de référence', () => {
  it('sort en Excellent quand marée, vent, houle, lune et lumière sont alignés', () => {
    const result = computeScore(IDEAL);
    expect(result.value).toBeGreaterThanOrEqual(8);
    expect(result.label).toBe('Excellent');
    expect(result.safety.level).toBe('ok');
    expect(result.safety.message).toBeUndefined();
  });
});

describe('formatage français', () => {
  it('n’écrit jamais de point décimal dans une note ou une raison', () => {
    const inputs = [
      IDEAL,
      withInput({ swell: { heightM: 2.7, periodS: 11 } }),
      withInput({ tide: { hoursFromHighTide: 3.4, coefficient: 118, state: 'falling' } }),
      withInput({ solunar: { ...IDEAL.solunar, hoursToMajorPeriod: 3.7, hoursToMinorPeriod: 4.2 } }),
      withInput({ wind: { speedKmh: 55.5, fromDeg: 90 } }),
    ];

    for (const input of inputs) {
      const result = computeScore(input);
      const texts = [
        ...result.reasons,
        ...Object.values(result.breakdown).map((entry) => entry.note),
        result.safety.message ?? '',
      ];
      for (const text of texts) {
        // Un chiffre suivi d'un point puis d'un chiffre = séparateur anglo-saxon.
        expect(text).not.toMatch(/\d\.\d/);
      }
    }
  });
});
