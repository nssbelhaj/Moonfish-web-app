import { describe, expect, it } from 'vitest';
import {
  compassPoint,
  exceedanceFraction,
  maxExpectedHeight,
  mostFrequentHeight,
  waveCount,
  waveHeights,
} from '../wave-statistics';

describe('loi de Rayleigh', () => {
  it('retrouve les deux nombres publiés par les services de prévision', () => {
    // C'est le contrôle qui valide le modèle : α = 1 doit donner « environ une
    // vague sur sept » et α = 2 « le double, trois fois par jour ». Si ces deux
    // valeurs ne tombaient pas, la formule serait fausse — et nous afficherions
    // une statistique inventée sous couvert d'océanographie.
    expect(exceedanceFraction(1)).toBeCloseTo(0.1353, 4);
    expect(Math.round(1 / exceedanceFraction(1))).toBe(7);

    expect(Math.round(1 / exceedanceFraction(2))).toBe(2981);
    // À 9 s de période, 24 h font 9 600 vagues, soit trois au-delà du double.
    expect(Math.round(waveCount(9, 24) * exceedanceFraction(2))).toBe(3);
  });

  it('décroît strictement avec le seuil', () => {
    let previous = 1;
    for (const alpha of [0.5, 1, 1.5, 2, 3]) {
      const p = exceedanceFraction(alpha);
      expect(p).toBeLessThan(previous);
      previous = p;
    }
  });

  it('vaut 1 sous un seuil nul ou négatif', () => {
    expect(exceedanceFraction(0)).toBe(1);
    expect(exceedanceFraction(-1)).toBe(1);
  });
});

describe('hauteurs dérivées', () => {
  it('donne la hauteur la plus fréquente à la moitié de la significative', () => {
    expect(mostFrequentHeight(0.6)).toBeCloseTo(0.3, 10);
    expect(mostFrequentHeight(2.5)).toBeCloseTo(1.25, 10);
  });

  it('n’attribue jamais de hauteur négative', () => {
    expect(mostFrequentHeight(-1)).toBe(0);
  });

  it('donne un maximum d’environ le double de la significative sur 24 h', () => {
    // C'est le chiffre que les sites de pêche affichent, et il sort de la
    // formule plutôt que d'une règle du pouce.
    const max = maxExpectedHeight(0.6, 9, 24);
    expect(max).not.toBeNull();
    expect((max as number) / 0.6).toBeGreaterThan(1.9);
    expect((max as number) / 0.6).toBeLessThan(2.2);
  });

  it('croît avec la durée d’observation', () => {
    const oneHour = maxExpectedHeight(1, 8, 1) as number;
    const day = maxExpectedHeight(1, 8, 24) as number;
    expect(day).toBeGreaterThan(oneHour);
  });

  it('refuse de conclure quand il n’y a pas assez de vagues', () => {
    // Sans vagues, pas de statistique : on rend `null` plutôt qu'un nombre.
    expect(maxExpectedHeight(1, 0, 24)).toBeNull();
    expect(maxExpectedHeight(0, 9, 24)).toBeNull();
    expect(maxExpectedHeight(1, 9, 0)).toBeNull();
  });

  it('ordonne toujours fréquente < significative < maximale', () => {
    for (const hs of [0.3, 0.6, 1.2, 2.5, 4]) {
      const h = waveHeights(hs, 9);
      expect(h.frequentM).toBeLessThan(h.significantM);
      expect(h.maxM as number).toBeGreaterThan(h.significantM);
    }
  });

  it('rapporte les deux fractions telles qu’on les affiche', () => {
    const h = waveHeights(0.6, 9);
    expect(h.exceedingSignificantPct).toBe(14);
    expect(h.oneInForDouble).toBe(2981);
  });
});

describe('rose des vents', () => {
  it('nomme les points cardinaux', () => {
    expect(compassPoint(0)).toBe('N');
    expect(compassPoint(90)).toBe('E');
    expect(compassPoint(180)).toBe('S');
    expect(compassPoint(270)).toBe('O');
  });

  it('nomme les secteurs intermédiaires en français', () => {
    expect(compassPoint(225)).toBe('SO');
    expect(compassPoint(315)).toBe('NO');
    expect(compassPoint(202.5)).toBe('SSO');
  });

  it('tourne proprement au passage du nord', () => {
    expect(compassPoint(360)).toBe('N');
    expect(compassPoint(720)).toBe('N');
    expect(compassPoint(-90)).toBe('O');
  });
});
