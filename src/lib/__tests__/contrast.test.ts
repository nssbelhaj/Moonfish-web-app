import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { contrastRatio, perceptualDistance } from '../contrast';

/**
 * Garde-fou de la palette — handoff v3.
 *
 * Les valeurs sont LUES dans tokens.css, jamais recopiées : un test qui duplique
 * la palette ne teste que sa propre copie.
 *
 * Ce fichier a trouvé, dans le handoff v3, trois paliers de score sous AA sur
 * --card alors que D21 les annonçait tous au-dessus, un fg-muted à 4,39:1 sur la
 * page, un danger de nuit à 4,40:1, et deux paires de paliers VOISINS
 * indistinguables. C'est la raison d'être du fichier : les contrastes annoncés
 * dans un handoff sont des intentions, pas des mesures.
 */
const TOKENS = readFileSync(path.join(process.cwd(), 'src/app/tokens.css'), 'utf8');

function literals(): Record<string, string> {
  const found: Record<string, string> = {};
  for (const m of TOKENS.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
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
  for (const m of block(selector).matchAll(/--([a-z0-9-]+):\s*var\(--([a-z0-9-]+)\)\s*;/g)) {
    const value = lit[m[2] as string];
    if (value) resolved[m[1] as string] = value;
  }
  // Le thème nuit n'écrase pas tout : ce qu'il ne redéfinit pas vient de :root.
  if (selector !== ':root') {
    for (const [k, v] of Object.entries(theme(':root'))) resolved[k] ??= v;
  }
  return resolved;
}

const THEMES = [
  ['thème clair', ':root'],
  ['thème nuit', "[data-theme='night']"],
] as const;

/**
 * Surfaces portant du TEXTE, et ce qui a le droit d'y être posé.
 *
 * `surface-2` est une surface de REMPLISSAGE (pastilles, jauges, aplats) : sur
 * les deux thèmes, seuls `fg` et `accent` y tiennent AA. Y poser un palier de
 * score ou le danger donne 2,8 à 4,1:1. Plutôt que de déformer une couleur de
 * remplissage pour un usage qu'elle n'a pas, la règle est écrite ici et
 * vérifiée : les paliers et le danger vivent sur --card ou --page.
 */
const TEXT_SURFACES = ['page', 'card'] as const;
const SURFACE_2_ALLOWED = ['fg', 'accent'] as const;
const INKS = ['fg', 'fg-muted', 'accent', 'danger', 'score-1', 'score-2', 'score-3', 'score-4'] as const;
const TIERS = ['score-1', 'score-2', 'score-3', 'score-4'] as const;

/** Seuil de séparation perceptuelle entre deux paliers VOISINS. */
const ADJACENT_SEPARATION = 0.13;

describe.each(THEMES)('%s', (_label, selector) => {
  const t = theme(selector);

  it('résout tous les tokens sémantiques attendus', () => {
    for (const key of [
      'page', 'card', 'surface-2', 'edge', 'edge-strong', 'water', 'accent',
      'fg', 'fg-muted', 'fg-on-accent', 'danger', 'warn',
      'score-1', 'score-2', 'score-3', 'score-4', 'focus',
    ]) {
      expect(t[key], `--${key} non résolu`).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it.each(INKS)('%s tient AA sur la page et sur les cartes', (ink) => {
    for (const surface of TEXT_SURFACES) {
      const ratio = contrastRatio(t[ink] as string, t[surface] as string);
      expect(ratio, `${ink} sur ${surface} = ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('ne laisse sur surface-2 que ce qui y tient', () => {
    for (const ink of SURFACE_2_ALLOWED) {
      const ratio = contrastRatio(t[ink] as string, t['surface-2'] as string);
      expect(ratio, `${ink} sur surface-2 = ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('garde le texte sur accent lisible', () => {
    const ratio = contrastRatio(t['fg-on-accent'] as string, t['accent'] as string);
    expect(ratio, `fg-on-accent sur accent = ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
  });

  it('garde la bague de focus visible sur la surface la plus claire', () => {
    // Le focus doit se voir sur le fond le plus proche de lui, pas sur le plus
    // contrasté : c'est là qu'il disparaît.
    const worst = Math.min(
      ...(['page', 'card', 'surface-2'] as const).map((s) =>
        contrastRatio(t['focus'] as string, t[s] as string),
      ),
    );
    expect(worst, `focus au pire = ${worst.toFixed(2)}:1`).toBeGreaterThanOrEqual(3);
  });

  it('donne au filet fort les 3:1 des éléments non textuels', () => {
    // R4 : la carte est un remplissage PLUS un filet. En thème clair le
    // remplissage ne fait que 1,05:1 avec la page — le filet porte donc seul la
    // frontière, et doit tenir le seuil non textuel de la WCAG 1.4.11.
    for (const surface of TEXT_SURFACES) {
      const ratio = contrastRatio(t['edge-strong'] as string, t[surface] as string);
      expect(ratio, `edge-strong sur ${surface} = ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(3);
    }
  });

  it('garde les paliers VOISINS perceptuellement distincts', () => {
    // Le contraste de luminance ne dit RIEN de la distinguabilité de deux
    // couleurs catégorielles : deux teintes peuvent tenir AA sur le même fond et
    // rester impossibles à séparer l'une de l'autre. Ce sont les paliers voisins
    // qui comptent — ce sont eux que l'œil doit trancher.
    for (let i = 0; i < TIERS.length - 1; i++) {
      const a = t[TIERS[i] as string] as string;
      const b = t[TIERS[i + 1] as string] as string;
      const d = perceptualDistance(a, b);
      expect(d, `${TIERS[i]} ↔ ${TIERS[i + 1]} = ${d.toFixed(3)}`).toBeGreaterThan(ADJACENT_SEPARATION);
    }
  });

  it('éloigne le danger de tous les paliers de score', () => {
    // Le rouge est réservé à la sécurité. Confondu avec un palier, il perd son
    // sens exactement le jour où il compte.
    for (const tier of TIERS) {
      const d = perceptualDistance(t['danger'] as string, t[tier] as string);
      expect(d, `danger ↔ ${tier} = ${d.toFixed(3)}`).toBeGreaterThan(0.12);
    }
  });

  it('distingue les quatre états de fraîcheur', () => {
    // « En attente » emprunte --edge-strong et non --fg-muted : en v3, l'accent
    // et le texte secondaire sont deux bleus gris à 0,044 l'un de l'autre en
    // thème clair. Deux pastilles qu'on ne sait pas distinguer ne transmettent
    // rien. --edge-strong est la couleur de STRUCTURE, ce qui dit exactement
    // « pas encore une information » — et elle tient les 3:1 non textuels.
    const chips = ['accent', 'warn', 'danger', 'edge-strong'] as const;
    for (let i = 0; i < chips.length; i++) {
      for (let j = i + 1; j < chips.length; j++) {
        const d = perceptualDistance(t[chips[i] as string] as string, t[chips[j] as string] as string);
        expect(d, `${chips[i]} ↔ ${chips[j]} = ${d.toFixed(3)}`).toBeGreaterThan(0.11);
      }
    }
  });
});

describe('les deux thèmes', () => {
  it('n’empruntent aucune couleur d’encre l’un à l’autre', () => {
    // D21 : « ne jamais utiliser un ton clair sur l'autre thème ». Une encre
    // partagée signifierait qu'un des deux thèmes la porte sur le mauvais fond.
    const clair = theme(':root');
    const nuit = theme("[data-theme='night']");
    for (const ink of ['fg', 'fg-muted', 'danger', 'score-1', 'score-2', 'score-4'] as const) {
      expect(clair[ink], `${ink} identique dans les deux thèmes`).not.toBe(nuit[ink]);
    }
  });
});
