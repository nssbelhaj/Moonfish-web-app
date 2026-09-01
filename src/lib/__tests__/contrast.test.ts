import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { contrastRatio, perceptualDistance } from '../contrast';

/**
 * Garde-fou de la palette.
 *
 * Les valeurs sont LUES dans globals.css, jamais recopiées ici : un test qui
 * duplique la palette ne teste que sa propre copie. Modifier une couleur sans
 * faire passer ce test casse le build — c'est le seul moyen fiable de tenir la
 * garantie AA à travers un changement de direction artistique.
 */
const CSS = readFileSync(path.join(process.cwd(), 'src/app/globals.css'), 'utf8');

function themeBlock(selector: string): string {
  const start = CSS.indexOf(`${selector} {`);
  if (start === -1) throw new Error(`Bloc introuvable : ${selector}`);
  return CSS.slice(start, CSS.indexOf('}', start));
}

function tokens(selector: string): Record<string, string> {
  const found: Record<string, string> = {};
  for (const match of themeBlock(selector).matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{3,8})\s*;/g)) {
    found[match[1] as string] = match[2] as string;
  }
  return found;
}

const SURFACES = ['page', 'card', 'card-raised'] as const;
const INKS = ['fg', 'fg-muted', 'fg-dim', 'score-bad', 'score-mid', 'score-good', 'score-best'] as const;

describe.each([
  ['thème sombre', ':root'],
  ['thème clair', '.theme-light'],
])('%s — contraste AA', (_label, selector) => {
  const palette = tokens(selector);

  it('définit toutes les surfaces et toutes les encres', () => {
    for (const name of [...SURFACES, ...INKS]) {
      expect(palette[name], `token manquant : --${name}`).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it.each(INKS)('%s tient 4,5:1 sur les trois surfaces', (ink) => {
    for (const surface of SURFACES) {
      const ratio = contrastRatio(palette[ink] as string, palette[surface] as string);
      expect(
        ratio,
        `${ink} sur ${surface} : ${ratio.toFixed(2)}:1, en dessous du seuil AA`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('garde les quatre paliers de score perceptuellement distincts', () => {
    // Mesuré en distance OKLab et non en contraste de luminance : deux teintes
    // franchement différentes peuvent avoir la même luminance, et le rapport de
    // contraste ne dit rien de leur distinguabilité.
    //
    // Ce test ne garantit pas la lisibilité en niveaux de gris — c'est la FORME
    // du palier qui s'en charge, quatrième canal redondant à côté du chiffre,
    // du libellé et de la couleur.
    //
    // Seuil à 0,13 : le rouge et l'ambre sont voisins par nature et ne peuvent
    // pas s'écarter davantage sans quitter leur sens. Il aurait suffi à
    // attraper le défaut réel qui a motivé ce test — deux paliers à 0,081.
    const tiers = ['score-bad', 'score-mid', 'score-good', 'score-best'] as const;
    for (let i = 0; i < tiers.length; i += 1) {
      for (let j = i + 1; j < tiers.length; j += 1) {
        const distance = perceptualDistance(palette[tiers[i]!] as string, palette[tiers[j]!] as string);
        expect(
          distance,
          `${tiers[i]} et ${tiers[j]} : distance ${distance.toFixed(3)}, trop proches`,
        ).toBeGreaterThan(0.13);
      }
    }
  });

  it('n’utilise jamais le noir pur ni le blanc pur en fond', () => {
    for (const surface of SURFACES) {
      expect(palette[surface]?.toLowerCase()).not.toBe('#000000');
      expect(palette[surface]?.toLowerCase()).not.toBe('#ffffff');
    }
  });

  it('garde la bague de focus visible sur la surface la plus claire', () => {
    const ratio = contrastRatio(palette.focus as string, palette['card-raised'] as string);
    expect(ratio, `focus : ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(3);
  });
});
