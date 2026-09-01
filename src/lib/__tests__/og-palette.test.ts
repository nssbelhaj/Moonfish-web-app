import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { OG_PALETTE, OG_PALETTE_SOURCE } from '../og-palette';

/**
 * L'image Open Graph est la seule exception à D22 : Satori la rend hors du DOM,
 * sans cascade CSS. Ce test empêche l'exception de devenir une dérive — chaque
 * littéral doit rester identique à sa source dans tokens.css.
 */
const TOKENS = readFileSync(path.join(process.cwd(), 'src/app/tokens.css'), 'utf8');

function literal(name: string): string {
  const match = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`).exec(TOKENS);
  if (!match) throw new Error(`Littéral introuvable dans tokens.css : --${name}`);
  return (match[1] as string).toLowerCase();
}

describe('palette de l’image Open Graph', () => {
  it.each(Object.keys(OG_PALETTE) as (keyof typeof OG_PALETTE)[])(
    '%s reste synchronisé avec tokens.css',
    (key) => {
      expect(OG_PALETTE[key].toLowerCase()).toBe(literal(OG_PALETTE_SOURCE[key]));
    },
  );
});
