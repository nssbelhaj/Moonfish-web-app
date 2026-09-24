import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { listGuides } from '@/lib/guides';

/**
 * La page des guides disait « Quatre guides » quand il y en avait dix. Le
 * même défaut que « 12 spots » : un nombre recopié dans un texte survit à tout
 * ce qui le rend faux. Ici on refuse tout nombre de guides écrit à la main.
 */
const RACINE = path.resolve(__dirname, '../../..');

describe('la page des guides', () => {
  it('n’écrit jamais leur nombre à la main', () => {
    const source = readFileSync(path.join(RACINE, 'src/app/guides/page.tsx'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '');
    const fautes = source.match(/\b(Quatre|Cinq|Six|Sept|Huit|Neuf|Dix|\d+)\s+(guides|articles)\b/g);
    expect(fautes, `nombre de guides en dur : ${fautes?.join(', ')}`).toBeNull();
    expect(source).toContain('listGuides()');
  });

  it('a un front-matter complet sur chaque guide, et des slugs uniques', async () => {
    const guides = await listGuides();
    expect(guides.length).toBeGreaterThanOrEqual(10);
    expect(new Set(guides.map((g) => g.slug)).size).toBe(guides.length);
    for (const guide of guides) {
      expect(guide.wordCount, `${guide.slug} trop court`).toBeGreaterThan(600);
      // Aucune promesse de prise, dans aucun guide.
      expect(guide.body, `${guide.slug} promet une prise`).not.toMatch(/prise garantie|à coup sûr|ça mord à tous les coups/i);
    }
  });
});
