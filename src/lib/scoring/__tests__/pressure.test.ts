import { describe, expect, it } from 'vitest';
import { computeScore } from '../compute';
import { SHARP_FALL_HPA, SHARP_RISE_HPA, describeTrend, levelFactor, scorePressure, trendFactor } from '../factors/pressure';
import { FACTOR_WEIGHTS } from '../types';
import { IDEAL, scoreOf, withInput } from './fixtures';

describe('tendance barométrique', () => {
  it('préfère une baisse douce à une pression stable', () => {
    // C'est le seul point sur lequel la pratique et la littérature s'accordent :
    // la baisse qui précède une perturbation ouvre une fenêtre.
    expect(trendFactor(-1.5)).toBeGreaterThan(trendFactor(0));
  });

  it('ne récompense pas une chute brutale', () => {
    // Une chute franche annonce du gros temps, pas une meilleure pêche. La
    // récompenser ferait monter le score juste avant un coup de vent.
    expect(trendFactor(-6)).toBeLessThan(trendFactor(-1.5));
  });

  it('place la hausse franche au plus bas', () => {
    const rising = trendFactor(SHARP_RISE_HPA + 1.5);
    expect(rising).toBeLessThan(trendFactor(0));
    expect(rising).toBeLessThan(trendFactor(-1.5));
  });

  it('ne pénalise pas le cas le plus fréquent, la pression stable', () => {
    // Une mer sans tendance marquée est la situation ordinaire : la noter bas
    // ferait chuter le score la plupart du temps, sans rien dire d'utile.
    expect(trendFactor(0)).toBeGreaterThanOrEqual(0.7);
  });

  it('reste borné, quelle que soit la variation', () => {
    for (const delta of [-40, -10, -3, 0, 3, 10, 40]) {
      const f = trendFactor(delta);
      expect(f).toBeGreaterThanOrEqual(0.3);
      expect(f).toBeLessThanOrEqual(1);
    }
  });

  it('nomme la tendance en français, sans chiffre dans le libellé', () => {
    expect(describeTrend(-4)).toBe('chute rapide');
    expect(describeTrend(-1.5)).toBe('en baisse');
    expect(describeTrend(0)).toBe('stable');
    expect(describeTrend(1.5)).toBe('en hausse');
    expect(describeTrend(4)).toBe('hausse rapide');
  });

  it('module à peine sur la valeur absolue', () => {
    // 1013 hPa n'est ni bon ni mauvais : le niveau ne doit jamais dominer la
    // tendance, seulement l'ajuster aux extrêmes.
    expect(levelFactor(1013)).toBe(1);
    expect(levelFactor(990)).toBeLessThan(1);
    expect(levelFactor(1035)).toBeLessThan(1);
    expect(levelFactor(990)).toBeGreaterThan(0.8);
  });
});

describe('facteur pression', () => {
  it('porte son poids nominal et une note lisible', () => {
    const r = scorePressure({ hPa: 1012, trend3hHpa: -1.4 });
    expect(r.nominalWeight).toBe(FACTOR_WEIGHTS.pressure);
    expect(r.score).toBeGreaterThan(0);
    expect(r.note).toContain('hPa');
    expect(r.note).toContain('en baisse');
  });

  it('n’écrit jamais de point décimal', () => {
    for (const delta of [-3.5, -1.2, 0.4, 2.8]) {
      expect(scorePressure({ hPa: 1009, trend3hHpa: delta }).note).not.toMatch(/\d\.\d/);
    }
  });

  it('se neutralise plutôt que de deviner une tendance absente', () => {
    // Sans tendance, une pression seule n'est pas une information. Inventer une
    // baisse ou une hausse orienterait le score sur rien.
    const r = scorePressure({ hPa: 1012, trend3hHpa: null });
    expect(r.score).toBe(5);
    expect(r.note).toContain('tendance inconnue');
  });

  it('se déclare indisponible quand la pression manque', () => {
    const r = scorePressure(null);
    expect(r.score).toBeNull();
    expect(r.weight).toBe(0);
    expect(r.nominalWeight).toBe(FACTOR_WEIGHTS.pressure);
  });

  it('annonce la dégradation quand la chute est franche', () => {
    const note = scorePressure({ hPa: 998, trend3hHpa: -SHARP_FALL_HPA - 1 }).note;
    expect(note).toContain('chute rapide');
    expect(note).toContain('se referme');
  });
});

describe('la pression dans le score global', () => {
  it('pèse, sans dominer', () => {
    const hausse = scoreOf(withInput({ pressure: { hPa: 1026, trend3hHpa: 3.5 } }));
    const baisse = scoreOf(withInput({ pressure: { hPa: 1008, trend3hHpa: -1.5 } }));

    expect(baisse).toBeGreaterThan(hausse);
    // Le facteur pèse 9 % : l'écart entre le meilleur et le pire cas de pression
    // ne peut donc pas dépasser un point sur dix. S'il le dépassait, la pression
    // aurait pris le pas sur la marée, ce que ni la donnée ni la littérature ne
    // justifient.
    expect(baisse - hausse).toBeLessThanOrEqual(1);
  });

  it('apparaît dans le détail avec son poids', () => {
    const { breakdown } = computeScore(IDEAL);
    expect(breakdown.pressure.score).not.toBeNull();
    expect(breakdown.pressure.weight).toBeCloseTo(FACTOR_WEIGHTS.pressure, 10);
    expect(breakdown.pressure.note).toContain('hPa');
  });

  it('laisse les poids nominaux sommer à 1', () => {
    const total = Object.values(FACTOR_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1, 10);
  });

  it('garde la marée comme premier facteur', () => {
    // L'ajout d'un sixième facteur ne doit pas avoir déclassé la marée : c'est
    // elle qui ouvre et ferme la fenêtre, tout le reste module.
    const weights = Object.entries(FACTOR_WEIGHTS).sort((a, b) => b[1] - a[1]);
    expect(weights[0]?.[0]).toBe('tide');
    expect(FACTOR_WEIGHTS.tide).toBeGreaterThan(FACTOR_WEIGHTS.pressure * 3);
  });
});
