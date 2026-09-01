import { describe, expect, it } from 'vitest';
import { computeScore } from '../compute';
import { evaluateSafety } from '../safety';
import { IDEAL, scoreOf, withInput } from './fixtures';

describe('sécurité — règle non négociable', () => {
  it('passe en danger dès que la houle dépasse 2,5 m', () => {
    expect(evaluateSafety(withInput({ swell: { heightM: 2.51, periodS: 10 } })).level).toBe('danger');
    expect(evaluateSafety(withInput({ swell: { heightM: 2.5, periodS: 10 } })).level).not.toBe('danger');
  });

  it('passe en danger dès que le vent dépasse 50 km/h', () => {
    expect(evaluateSafety(withInput({ wind: { speedKmh: 50.1, fromDeg: 270 } })).level).toBe('danger');
    expect(evaluateSafety(withInput({ wind: { speedKmh: 50, fromDeg: 270 } })).level).not.toBe('danger');
  });

  it('déclenche la vigilance ambre entre 2,0 et 2,5 m de houle', () => {
    const verdict = evaluateSafety(withInput({ swell: { heightM: 2.2, periodS: 10 } }));
    expect(verdict.level).toBe('prudence');
    expect(verdict.message).toContain('Vigilance');
  });

  it('reste ok sur le créneau de référence', () => {
    expect(evaluateSafety(IDEAL).level).toBe('ok');
  });

  /**
   * Le test qui compte : la sécurité ne doit JAMAIS être dérivée du score.
   * On construit un créneau halieutiquement excellent — pleine mer, coefficient
   * idéal, période majeure, aube — mais avec 3 m de houle.
   */
  it('affiche le danger même quand les autres facteurs tirent le score vers le haut', () => {
    const result = computeScore(
      withInput({
        swell: { heightM: 3, periodS: 12 },
        wind: { speedKmh: 14, fromDeg: 270 },
      }),
    );

    expect(result.safety.level).toBe('danger');
    expect(result.breakdown.tide.score).toBeGreaterThanOrEqual(9);
    expect(result.breakdown.solunar.score).toBeGreaterThanOrEqual(9);
    expect(result.reasons[0]).toContain('sécurité prime');
  });

  it('cumule les causes dans le message quand vent et houle sont tous deux hors limites', () => {
    const message =
      evaluateSafety(
        withInput({
          swell: { heightM: 3.2, periodS: 9 },
          wind: { speedKmh: 62, fromDeg: 250 },
        }),
      ).message ?? '';

    expect(message).toContain('houle');
    expect(message).toContain('vent');
  });
});

describe('cumul de facteurs négatifs', () => {
  it('sort en Médiocre quand marée, vent, houle, lune et lumière sont tous défavorables', () => {
    const worst = computeScore({
      spotFacingDeg: 270,
      tide: { hoursFromHighTide: 6.2, coefficient: 118, state: 'slack' },
      wind: { speedKmh: 47, fromDeg: 90 },
      swell: { heightM: 0.1, periodS: 3 },
      solunar: {
        hoursToMajorPeriod: 5,
        hoursToMinorPeriod: 5,
        moonIlluminationPct: 50,
        moonAgeDays: 7.4,
      },
      light: { phase: 'day' },
    });

    expect(worst.value).toBeLessThan(4);
    expect(worst.label).toBe('Médiocre');
    expect(worst.safety.level).toBe('prudence');
  });

  it('classe le cumul négatif strictement sous chaque dégradation isolée', () => {
    const base = scoreOf(IDEAL);
    const onlyWind = scoreOf(withInput({ wind: { speedKmh: 47, fromDeg: 90 } }));
    const onlySwell = scoreOf(withInput({ swell: { heightM: 0.1, periodS: 3 } }));
    const both = scoreOf(
      withInput({ wind: { speedKmh: 47, fromDeg: 90 }, swell: { heightM: 0.1, periodS: 3 } }),
    );

    expect(both).toBeLessThan(onlyWind);
    expect(both).toBeLessThan(onlySwell);
    expect(onlyWind).toBeLessThan(base);
  });
});
