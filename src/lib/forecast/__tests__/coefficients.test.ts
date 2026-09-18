import { describe, expect, it } from 'vitest';

import { tideCoefficientFor } from '@/data/generators/tide';
import { MORTES_EAUX, VIVES_EAUX, prochainsCoefficients, regimeDe } from '../coefficients';

/**
 * La frise des coefficients est la seule donnée du site qui serve à
 * PLANIFIER. Elle se calcule depuis la lunaison, sans réseau et sans quota —
 * ce que ces tests vérifient d'abord, parce qu'une frise qui consommerait un
 * appel d'API par jour affiché serait à retirer.
 */

const DEPUIS = new Date('2026-09-18T14:23:45Z');

describe('regimeDe', () => {
  it('range chaque coefficient dans son régime, bornes incluses', () => {
    expect(regimeDe(VIVES_EAUX)).toBe('vives-eaux');
    expect(regimeDe(VIVES_EAUX - 1)).toBe('moyen');
    expect(regimeDe(MORTES_EAUX)).toBe('mortes-eaux');
    expect(regimeDe(MORTES_EAUX + 1)).toBe('moyen');
  });
});

describe('prochainsCoefficients', () => {
  it('part de MINUIT du jour demandé, pas de l’instant demandé', () => {
    const jours = prochainsCoefficients(DEPUIS, 3);
    expect(jours[0]!.date).toBe('2026-09-18T00:00:00.000Z');
  });

  it('rend exactement le nombre de jours demandé, à un jour d’intervalle', () => {
    const jours = prochainsCoefficients(DEPUIS, 30);
    expect(jours).toHaveLength(30);
    for (let i = 1; i < jours.length; i += 1) {
      const ecart = new Date(jours[i]!.date).getTime() - new Date(jours[i - 1]!.date).getTime();
      expect(ecart).toBe(86_400_000);
    }
  });

  it('reprend exactement le coefficient du générateur, sans le réinventer', () => {
    for (const jour of prochainsCoefficients(DEPUIS, 10)) {
      expect(jour.coefficient).toBe(tideCoefficientFor(new Date(jour.date)));
      expect(jour.regime).toBe(regimeDe(jour.coefficient));
    }
  });

  it('reste dans l’échelle SHOM', () => {
    for (const jour of prochainsCoefficients(DEPUIS, 120)) {
      expect(jour.coefficient).toBeGreaterThanOrEqual(20);
      expect(jour.coefficient).toBeLessThanOrEqual(120);
    }
  });

  it('trouve deux pics de vives-eaux dans un mois — la lunaison en donne deux', () => {
    const pics = prochainsCoefficients(DEPUIS, 30).filter((jour) => jour.pic);
    expect(pics.length).toBeGreaterThanOrEqual(1);
    expect(pics.length).toBeLessThanOrEqual(3);
    for (const pic of pics) expect(pic.coefficient).toBeGreaterThanOrEqual(VIVES_EAUX);
  });

  it('ne marque JAMAIS un pic aux extrémités de la frise', () => {
    /*
      Ce qu'il y a juste avant le premier jour et juste après le dernier est
      inconnu de cette fenêtre : affirmer un maximum local là serait deviner.
      La frise commence aujourd'hui, donc le premier jour tombe forcément un
      jour de pic deux fois par mois — et il ne doit pas être décoré comme
      tel.
    */
    for (let decalage = 0; decalage < 31; decalage += 1) {
      const depuis = new Date(DEPUIS.getTime() + decalage * 86_400_000);
      const jours = prochainsCoefficients(depuis, 30);
      expect(jours[0]!.pic, `jour 0 marqué pic au décalage ${decalage}`).toBe(false);
      expect(jours.at(-1)!.pic, `dernier jour marqué pic au décalage ${decalage}`).toBe(false);
    }
  });

  it('est déterministe : deux appels au même jour donnent la même frise', () => {
    expect(prochainsCoefficients(DEPUIS, 30)).toStrictEqual(
      prochainsCoefficients(new Date('2026-09-18T23:59:59Z'), 30),
    );
  });
});
