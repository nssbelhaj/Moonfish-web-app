import { describe, expect, it } from 'vitest';
import { coefficientFactor, scoreTide, tidePositionFactor } from '../factors/tide';
import { IDEAL, scoreOf, withInput } from './fixtures';

const at = (hoursFromHighTide: number, coefficient = 82, state: 'rising' | 'falling' | 'slack' = 'rising') =>
  scoreTide({ hoursFromHighTide, coefficient, state });

describe('marée — fenêtre optimale', () => {
  it('note au maximum la fenêtre -2 h → +1 h autour de la pleine mer', () => {
    for (const h of [-1.8, -1, -0.6, 0.6, 0.9]) {
      expect(at(h).score).toBeGreaterThanOrEqual(9);
    }
  });

  it('reconnaît la descendante établie comme une seconde bonne fenêtre', () => {
    const ebb = at(3).score;
    expect(ebb).toBeGreaterThan(7);
    // Elle reste sous la fenêtre de pleine mer : c'est la hiérarchie de la spec.
    expect(ebb).toBeLessThan(at(-1).score);
  });

  it('classe la basse mer très en dessous de la pleine mer', () => {
    expect(at(6.2).score).toBeLessThan(2);
    expect(at(6.2).score).toBeLessThan(at(-1).score);
  });
});

describe('marée — étale', () => {
  it('creuse le score au renverse exact de pleine mer', () => {
    const turn = at(0, 82, 'slack').score;
    const running = at(-1, 82, 'rising').score;
    expect(turn).toBeLessThan(running);
  });

  it('pénalise un état slack remonté par le fournisseur même en pleine fenêtre', () => {
    expect(at(-1, 82, 'slack').score).toBeLessThan(at(-1, 82, 'rising').score);
  });

  it('pénalise l’étale de basse mer plus durement que celle de pleine mer', () => {
    expect(at(6.2, 82, 'slack').score).toBeLessThan(at(0, 82, 'slack').score);
  });
});

describe('marée — coefficient', () => {
  it('tient le plateau optimal entre 70 et 95', () => {
    expect(coefficientFactor(70)).toBeCloseTo(1, 6);
    expect(coefficientFactor(82)).toBeCloseTo(1, 6);
    expect(coefficientFactor(95)).toBeCloseTo(1, 6);
  });

  it('ne dégrade que partiellement la zone correcte 45–70', () => {
    expect(coefficientFactor(50)).toBeGreaterThan(0.7);
    expect(coefficientFactor(50)).toBeLessThan(1);
  });

  it('pénalise un coefficient extrême au-delà de 110 : courant trop fort', () => {
    expect(coefficientFactor(118)).toBeLessThan(0.65);
    const strong = at(-1, 118).score;
    const normal = at(-1, 82).score;
    expect(strong).toBeLessThan(normal);
    expect(at(-1, 118).note).toContain('courant trop fort');
  });

  it('pénalise aussi un coefficient trop faible : la marée ne brasse rien', () => {
    expect(coefficientFactor(28)).toBeLessThan(0.65);
    expect(at(-1, 28).note).toContain('marée trop molle');
  });

  it('fait chuter le score global d’un créneau parfait sur le seul coefficient', () => {
    const extreme = scoreOf(withInput({ tide: { hoursFromHighTide: -1, coefficient: 119, state: 'rising' } }));
    expect(extreme).toBeLessThan(scoreOf(IDEAL));
  });
});

describe('marée — continuité de la courbe', () => {
  it('n’ouvre aucun trou entre la fin de la descendante et l’étale de basse mer', () => {
    // Régression : le facteur retombait à 0 exact sur [5,2 h ; 5,6 h], donc sous
    // l'étale de basse mer elle-même. Aucun point du cycle ne doit passer sous
    // le mouvement résiduel.
    for (let h = -6.2; h <= 6.2; h += 0.05) {
      expect(tidePositionFactor(h)).toBeGreaterThanOrEqual(0.12);
    }
  });

  it('décroît de la descendante établie vers la basse mer, sans rebond', () => {
    let previous = Number.POSITIVE_INFINITY;
    for (let h = 4.4; h <= 6.2; h += 0.1) {
      const current = at(h).score;
      expect(current).toBeLessThanOrEqual(previous + 1e-9);
      previous = current;
    }
    expect(at(6.2).score).toBeLessThan(at(4.4).score);
  });
});
