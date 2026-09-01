import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { contrastRatio, perceptualDistance } from '../contrast';

/**
 * Garde-fou de la palette (§2.6 : « AA tenu, sans exception. On ne descend pas »).
 *
 * Les valeurs sont LUES dans tokens.css, jamais recopiées : un test qui
 * duplique la palette ne teste que sa propre copie.
 */
const TOKENS = readFileSync(path.join(process.cwd(), 'src/app/tokens.css'), 'utf8');

function literals(): Record<string, string> {
  const found: Record<string, string> = {};
  for (const m of TOKENS.matchAll(/--([a-z]+-\d{3}):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    found[m[1] as string] = (m[2] as string).toLowerCase();
  }
  return found;
}

function block(selector: string): string {
  const start = TOKENS.indexOf(selector);
  return TOKENS.slice(start, TOKENS.indexOf('\n}', start));
}

/** Résout les tokens sémantiques d'un thème vers leurs littéraux. */
function theme(selector: string): Record<string, string> {
  const lit = literals();
  const resolved: Record<string, string> = {};
  for (const m of block(selector).matchAll(/--([a-z0-9-]+):\s*var\(--([a-z]+-\d{3})\)\s*;/g)) {
    resolved[m[1] as string] = lit[m[2] as string] as string;
  }
  return resolved;
}

const INKS_EVERYWHERE = ['fg', 'fg-muted', 'score-1', 'score-2', 'score-3', 'score-4', 'danger', 'accent-data', 'accent-score'] as const;
const ALL_SURFACES = ['page', 'card', 'card-2', 'chip'] as const;

describe.each([
  ['thème sombre', ':root'],
  ['thème guide', "[data-theme='guide']"],
])('%s', (_label, selector) => {
  const t = theme(selector);

  it('résout tous les tokens sémantiques attendus', () => {
    for (const name of [...INKS_EVERYWHERE, ...ALL_SURFACES, 'fg-faint', 'fg-on-accent', 'focus']) {
      expect(t[name], `token non résolu : --${name}`).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it.each(INKS_EVERYWHERE)('%s tient AA sur les quatre surfaces', (ink) => {
    for (const surface of ALL_SURFACES) {
      const ratio = contrastRatio(t[ink] as string, t[surface] as string);
      expect(ratio, `${ink} sur ${surface} : ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
    }
  });

  /**
   * `fg-faint` est le plancher du système. Le handoff garantit 4,6:1 sur
   * card-2 — mais PAS sur chip, où il tombe à 4,13:1. La règle qui en découle
   * est vérifiée côté usage par `color-classes.test.ts` : jamais de texte faint
   * sur une surface chip.
   */
  it('fg-faint tient AA sur page, card et card-2', () => {
    for (const surface of ['page', 'card', 'card-2'] as const) {
      const ratio = contrastRatio(t['fg-faint'] as string, t[surface] as string);
      expect(ratio, `fg-faint sur ${surface} : ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('garde le texte sur accent lisible', () => {
    const ratio = contrastRatio(t['fg-on-accent'] as string, t['accent-score'] as string);
    expect(ratio, `fg-on-accent sur accent-score : ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
  });

  it('garde la bague de focus visible sur la surface la plus claire', () => {
    const ratio = contrastRatio(t.focus as string, t.chip as string);
    expect(ratio, `focus : ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(3);
  });

  /**
   * D5 : l'échelle n'est pas un dégradé rouge → vert, et les quatre paliers
   * doivent rester séparables. Mesuré en distance OKLab, pas en contraste de
   * luminance : deux teintes différentes peuvent avoir la même luminance.
   *
   * Vérifié sur le thème de l'app uniquement. En thème guide, `score-1` est un
   * gris foncé désaturé : en OKLab il est proche de tout ce qui l'entoure, et
   * l'écarter demanderait de le noircir jusqu'à ce que « Médiocre » se lise
   * comme une emphase. Aucun score ne se rend dans une page éditoriale — c'est
   * la raison de la limite, et elle tombe le jour où un guide affiche un score.
   */
  it.runIf(selector === ':root')('garde les quatre paliers perceptuellement distincts', () => {
    const tiers = ['score-1', 'score-2', 'score-3', 'score-4'] as const;
    for (let i = 0; i < tiers.length; i += 1) {
      for (let j = i + 1; j < tiers.length; j += 1) {
        const d = perceptualDistance(t[tiers[i]!] as string, t[tiers[j]!] as string);
        expect(d, `${tiers[i]} et ${tiers[j]} : ${d.toFixed(3)}`).toBeGreaterThan(0.13);
      }
    }
  });

  /** D5 : le rouge est réservé, exclusivement, à la sécurité. */
  it.runIf(selector === ':root')('éloigne le danger de tous les paliers de score', () => {
    for (const tier of ['score-1', 'score-2', 'score-3', 'score-4'] as const) {
      const d = perceptualDistance(t.danger as string, t[tier] as string);
      expect(d, `danger et ${tier} : ${d.toFixed(3)}`).toBeGreaterThan(0.13);
    }
  });
});

/**
 * Les quatre puces de fraîcheur (R9) doivent se distinguer les unes des autres.
 *
 * Même leçon que les paliers de score : le contraste de luminance ne dit RIEN de
 * la distinguabilité de deux couleurs catégorielles. Deux oranges peuvent tenir
 * AA sur le même fond et rester indiscernables entre elles.
 *
 * Le test porte sur le THÈME SOMBRE seul, parce que c'est le seul où ces puces
 * apparaissent : `DataSourceTag` ne vit que sur les pages de spot, et le thème
 * guide est réservé aux pages éditoriales (D6). En thème guide, trois paires
 * mesurées seraient sous le seuil — accent-data/fg-faint à 0,097,
 * warn/danger à 0,103, warn/fg-faint à 0,117 — parce que la série 800 est une
 * palette de TEXTE sur papier clair, resserrée exprès. Y forcer l'écart
 * déplacerait `--accent-score` et `--danger`, donc les paliers de score, pour
 * corriger un rendu qui n'existe pas. Le jour où une puce apparaîtra sur une
 * page guide, c'est la palette guide qu'il faudra rouvrir, pas ce test.
 */
describe('thème sombre — les puces de fraîcheur', () => {
  const t = theme(':root');
  const CHIPS = ['accent-data', 'warn', 'danger', 'fg-faint'] as const;

  it('résout les quatre couleurs de puce', () => {
    for (const chip of CHIPS) expect(t[chip]).toMatch(/^#[0-9a-f]{6}$/);
  });

  it.each(
    CHIPS.flatMap((a, i) => CHIPS.slice(i + 1).map((b) => [a, b] as const)),
  )('distingue %s de %s', (a, b) => {
    expect(perceptualDistance(t[a] as string, t[b] as string)).toBeGreaterThan(0.12);
  });
});
