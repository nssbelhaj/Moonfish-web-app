import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Règle D22 — aucun composant ne contient de couleur littérale.
 *
 * « C'est la seule garantie qu'un thème reste changeable sans toucher un
 * composant : la règle tient par l'outillage, pas par la discipline. »
 *
 * Deux fichiers déclarent les couleurs, un troisième est une exception motivée
 * et sous surveillance (voir `og-palette.test.ts`).
 */
const ALLOWED = new Set([
  'src/app/tokens.css',
  'src/lib/og-palette.ts',
  'src/lib/contrast.ts',
  'src/lib/theme.ts',
  // Un courriel n'a pas de variables CSS : les clients de messagerie ne les
  // appliquent pas, et beaucoup n'acceptent que le style en ligne. Le gabarit
  // reprend les tokens du thème clair, écrits en clair faute d'alternative.
  'src/lib/auth/email-template.ts',
]);

/** Les tests de palette manipulent forcément des littéraux. */
const ALLOWED_DIRS = ['src/lib/__tests__'];

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return sources(full);
    return /\.(tsx?|css)$/.test(full) ? [full] : [];
  });
}

describe('D22 — aucune couleur littérale hors des tokens', () => {
  it('ne trouve ni code hexadécimal ni rgb() dans les composants et les pages', () => {
    const offenders: string[] = [];
    const pattern = /#[0-9a-fA-F]{3,8}\b|\brgba?\s*\(/g;

    for (const file of sources(path.join(process.cwd(), 'src'))) {
      const relative = path.relative(process.cwd(), file);
      if (ALLOWED.has(relative)) continue;
      if (ALLOWED_DIRS.some((dir) => relative.startsWith(dir))) continue;

      for (const match of readFileSync(file, 'utf8').matchAll(pattern)) {
        // Les entités et échappements unicode ne sont pas des couleurs.
        if (/^#[0-9a-fA-F]{3,8}$/.test(match[0])) offenders.push(`${relative} → ${match[0]}`);
        else offenders.push(`${relative} → ${match[0].trim()}`);
      }
    }

    expect(offenders, `couleurs littérales interdites :\n${offenders.join('\n')}`).toEqual([]);
  });
});
