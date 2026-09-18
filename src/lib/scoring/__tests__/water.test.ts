import { describe, expect, it } from 'vitest';

import { computeScore } from '../compute';
import { CHAUD_LIMITANT_C, FROID_VIF_C, describeWater, scoreWater, waterFactor } from '../factors/water';
import { FACTOR_WEIGHTS } from '../types';
import { IDEAL } from './fixtures';

/**
 * La température de l'eau : ce qu'elle peut dire, et ce qu'elle ne doit pas
 * prétendre.
 */
describe('le facteur température de l’eau', () => {
  it('ne condamne jamais un créneau à lui seul', () => {
    /*
      Le plancher à 0,45 est le cœur du facteur : une eau à 4 °C rend la pêche
      difficile, elle ne l'annule pas — des pêcheurs prennent du bar en plein
      hiver. Un facteur capable de descendre à zéro ferait basculer une
      journée entière de « Bon » à « Médiocre » sur la seule foi d'un chiffre
      qui bouge de deux dixièmes par jour.
    */
    for (const c of [-2, 0, 4, 8, 30, 35]) {
      expect(waterFactor(c), `${c} °C`).toBeGreaterThanOrEqual(0.45);
      expect(waterFactor(c), `${c} °C`).toBeLessThanOrEqual(1);
    }
  });

  it('couvre la Bretagne ET le Maroc à plein régime', () => {
    // Le catalogue va de Pen Hat à Dakhla. Une courbe calée sur le bar breton
    // mettrait Agadir en défaut toute l'année, alors qu'on y pêche très bien.
    for (const c of [11, 14, 17, 20, 22]) {
      expect(waterFactor(c), `${c} °C`).toBe(1);
    }
  });

  it('pénalise le froid vif et le chaud limitant, en douceur', () => {
    expect(waterFactor(5)).toBeLessThan(waterFactor(FROID_VIF_C));
    expect(waterFactor(FROID_VIF_C)).toBeLessThan(waterFactor(12));
    expect(waterFactor(26)).toBeLessThan(waterFactor(CHAUD_LIMITANT_C));
    expect(waterFactor(CHAUD_LIMITANT_C)).toBeLessThan(waterFactor(20));
  });

  it('est monotone : plus on s’éloigne du plateau, moins c’est favorable', () => {
    const froid = [2, 5, 8, 10, 11].map(waterFactor);
    const chaud = [22, 23, 25, 27, 30].map(waterFactor);
    for (let i = 1; i < froid.length; i += 1) expect(froid[i]!).toBeGreaterThanOrEqual(froid[i - 1]!);
    for (let i = 1; i < chaud.length; i += 1) expect(chaud[i]!).toBeLessThanOrEqual(chaud[i - 1]!);
  });

  it('explique en français, sans promettre de prise', () => {
    for (const c of [4, 8, 10, 16, 23, 26]) {
      const note = scoreWater({ celsius: c }).note;
      expect(note).toContain('°C');
      expect(note).toContain(describeWater(c));
      for (const interdit of ['garanti', 'assuré', 'vous prendrez', 'ça mord']) {
        expect(note.toLowerCase()).not.toContain(interdit);
      }
    }
  });

  it('sort du calcul quand l’eau n’est pas mesurée, sans valeur par défaut', () => {
    const sans = scoreWater(null);
    expect(sans.score).toBeNull();
    expect(sans.weight).toBe(0);

    // Le score se calcule quand même, sur les six autres facteurs renormalisés.
    const resultat = computeScore({ ...IDEAL, water: null });
    expect(resultat.value).not.toBeNull();
    expect(resultat.coverage).toBeCloseTo(1 - FACTOR_WEIGHTS.water, 5);
    expect(resultat.breakdown.water.score).toBeNull();
  });

  it('pèse ce qu’il annonce, et pas davantage', () => {
    /*
      L'eau bouge de quelques dixièmes par jour : elle départage des saisons,
      pas deux créneaux du même après-midi. L'écart entre la meilleure et la
      pire eau possible doit donc rester borné — sinon une journée entière
      basculerait de palier sur un chiffre quasi constant.
    */
    const chaude = computeScore({ ...IDEAL, water: { celsius: 16 } }).value!;
    const glacee = computeScore({ ...IDEAL, water: { celsius: 2 } }).value!;
    expect(chaude).toBeGreaterThan(glacee);
    expect(chaude - glacee).toBeLessThanOrEqual(10 * FACTOR_WEIGHTS.water + 0.1);
  });

  it('laisse la somme des poids à 1', () => {
    const somme = Object.values(FACTOR_WEIGHTS).reduce((t, p) => t + p, 0);
    expect(somme).toBeCloseTo(1, 10);
  });
});
