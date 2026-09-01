import { describe, expect, it } from 'vitest';
import { computeScore } from '../compute';
import { FACTOR_WEIGHTS, type ScoreFactor } from '../types';
import { IDEAL, scoreOf, withInput } from './fixtures';

const ALL: ScoreFactor[] = ['tide', 'wind', 'swell', 'solunar', 'light'];

/**
 * D11 — un score calculé avec un facteur manquant le DÉCLARE.
 *
 * Ces tests gardent la seule chose qui rend le produit défendable quand un
 * fournisseur tombe : le score ne doit jamais se présenter comme complet alors
 * qu'il ne l'est pas, et une source absente ne doit jamais être traitée comme
 * une mauvaise condition.
 */
describe('sources manquantes — renormalisation', () => {
  it('écarte le facteur manquant et renormalise les poids restants à 1', () => {
    const { breakdown } = computeScore(withInput({ swell: null }));

    expect(breakdown.swell.score).toBeNull();
    expect(breakdown.swell.weight).toBe(0);
    // Le poids NOMINAL, lui, ne bouge pas : c'est ce qui permet à l'interface de
    // dire « pesait 20 % » plutôt que de faire disparaître la ligne.
    expect(breakdown.swell.nominalWeight).toBe(FACTOR_WEIGHTS.swell);

    const total = ALL.reduce((sum, factor) => sum + breakdown[factor].weight, 0);
    expect(total).toBeCloseTo(1, 10);
  });

  it('donne à chaque facteur restant sa part exacte du poids disponible', () => {
    const { breakdown } = computeScore(withInput({ swell: null }));
    const available = 1 - FACTOR_WEIGHTS.swell;

    for (const factor of ALL) {
      if (factor === 'swell') continue;
      expect(breakdown[factor].weight).toBeCloseTo(FACTOR_WEIGHTS[factor] / available, 10);
    }
  });

  it('rapporte la couverture réellement atteinte', () => {
    expect(computeScore(IDEAL).coverage).toBeCloseTo(1, 10);
    expect(computeScore(withInput({ swell: null })).coverage).toBeCloseTo(0.8, 10);
    expect(computeScore(withInput({ tide: null, swell: null })).coverage).toBeCloseTo(0.45, 10);
  });

  it('vaut exactement la moyenne pondérée des facteurs restants', () => {
    const result = computeScore(withInput({ tide: null }));
    const expected = ALL.filter((f) => f !== 'tide').reduce((sum, factor) => {
      const entry = result.breakdown[factor];
      return sum + (entry.score ?? 0) * entry.weight;
    }, 0);

    expect(result.value).toBeCloseTo(Math.round(expected * 10) / 10, 10);
  });
});

describe('sources manquantes — une absence n’est pas un zéro', () => {
  it('ne fait pas chuter le score comme le ferait un facteur à 0', () => {
    // Sans la marée, le score doit rester dans la plage des autres facteurs.
    // Un `null` traité comme 0 donnerait ici un score amputé de 35 %.
    const withTide = scoreOf(IDEAL);
    const withoutTide = computeScore(withInput({ tide: null })).value;

    expect(withoutTide).not.toBeNull();
    expect(withoutTide as number).toBeGreaterThan(withTide * 0.7);
  });

  it('remonte le score quand c’est un MAUVAIS facteur qui disparaît', () => {
    // Une houle exécrable tire le score vers le bas ; sans mesure de houle, le
    // score ne peut pas prétendre en tenir compte, donc il remonte.
    const bad = withInput({ swell: { heightM: 0.05, periodS: 2 } });
    const unknown = withInput({ swell: null });

    expect(computeScore(unknown).value as number).toBeGreaterThan(scoreOf(bad));
  });

  it('n’a plus de score du tout quand aucune source n’est disponible', () => {
    const result = computeScore({
      spotFacingDeg: 270,
      tide: null,
      wind: null,
      swell: null,
      solunar: null,
      light: null,
    });

    expect(result.value).toBeNull();
    expect(result.label).toBeNull();
    expect(result.coverage).toBe(0);
    expect(result.reasons).toStrictEqual(['Prévision indisponible pour ce créneau.']);
  });
});

describe('sources manquantes — la déclaration', () => {
  it('nomme la source absente dans les raisons', () => {
    const { reasons } = computeScore(withInput({ swell: null }));
    expect(reasons.join(' ')).toContain('Calculé sans la houle');
  });

  it('énumère correctement plusieurs sources absentes', () => {
    const { reasons } = computeScore(withInput({ swell: null, tide: null }));
    const joined = reasons.join(' ');
    expect(joined).toContain('Calculé sans la marée ni la houle');
    expect(joined).toContain('sources indisponibles');
  });

  it('place la déclaration avant les arguments, jamais après', () => {
    const { reasons } = computeScore(withInput({ swell: null }));
    const index = reasons.findIndex((reason) => reason.startsWith('Calculé sans'));
    expect(index).toBe(1);
  });

  it('ne déclare rien quand tout est là', () => {
    const { reasons } = computeScore(IDEAL);
    expect(reasons.join(' ')).not.toContain('Calculé sans');
  });

  it('marque le facteur manquant dans le détail, sans lui inventer de note', () => {
    const { breakdown } = computeScore(withInput({ wind: null }));
    expect(breakdown.wind.note).toBe('vent indisponible pour ce créneau');
  });
});

describe('sources manquantes — la sécurité ne présume rien', () => {
  it('ne dit jamais « ok » sans mesure de houle', () => {
    const verdict = computeScore(withInput({ swell: null })).safety;
    expect(verdict.level).not.toBe('ok');
    expect(verdict.message).toContain('la houle');
  });

  it('ne dit jamais « ok » sans mesure de vent', () => {
    const verdict = computeScore(withInput({ wind: null })).safety;
    expect(verdict.level).not.toBe('ok');
    expect(verdict.message).toContain('le vent');
  });

  it('dit explicitement que les seuils n’ont pas pu être vérifiés', () => {
    const verdict = computeScore(withInput({ wind: null, swell: null })).safety;
    expect(verdict.level).toBe('prudence');
    expect(verdict.message).toContain('n’ont pas pu être vérifiés');
    expect(verdict.message).toContain('l’absence de donnée');
  });

  it('garde le danger quand la source qui reste dépasse le seuil', () => {
    // Sans vent mais avec 3 m de houle, le danger prime : une source manquante
    // ne doit jamais adoucir un seuil que l'autre source franchit.
    const verdict = computeScore(
      withInput({ wind: null, swell: { heightM: 3, periodS: 12 } }),
    ).safety;
    expect(verdict.level).toBe('danger');
  });

  it('n’écrit jamais de point décimal, même dans le message d’indisponibilité', () => {
    const verdict = computeScore(withInput({ wind: null, swell: null })).safety;
    expect(verdict.message ?? '').not.toMatch(/\d\.\d/);
  });
});
