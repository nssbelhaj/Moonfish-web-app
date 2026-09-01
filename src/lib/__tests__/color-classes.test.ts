import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Aucune classe Tailwind ne doit désigner une couleur absente de la palette.
 *
 * Motivé par un vrai bug : lors du passage à la palette v2, le bouton primaire
 * portait encore `text-abyss`, un littéral supprimé. Tailwind ne génère alors
 * aucune règle — la classe devient un no-op SILENCIEUX, le texte hérite de la
 * couleur du parent, et un bouton blanc sur vert descend à 1,62:1. Ni le
 * compilateur, ni le linter, ni le test de contraste des tokens ne pouvaient
 * l'attraper : seule une vérification des usages le peut.
 */
const CONFIG = readFileSync(path.join(process.cwd(), 'tailwind.config.ts'), 'utf8');

/** Noms de couleurs déclarés dans la config, y compris les clés imbriquées. */
function declaredColors(): Set<string> {
  const block = CONFIG.slice(CONFIG.indexOf('colors: {'), CONFIG.indexOf('fontFamily:'));
  const names = new Set<string>();
  for (const match of block.matchAll(/^\s*'?([a-z0-9-]+)'?:/gm)) {
    names.add(match[1] as string);
  }
  // Paliers imbriqués : `score: { bad: {...} }` donne aussi score-bad.
  for (const tier of ['bad', 'mid', 'good', 'best']) names.add(`score-${tier}`);
  for (const tier of ['bad', 'mid', 'good', 'best']) {
    names.add(`score-${tier}-dark`);
    names.add(`score-${tier}-light`);
  }
  return names;
}

/** Couleurs fournies par Tailwind lui-même, toujours valides. */
const BUILT_IN = new Set([
  'transparent', 'current', 'inherit', 'white', 'black',
  'red', 'green', 'blue', 'gray', 'slate', 'zinc', 'neutral', 'stone',
]);

const PREFIXES = ['text', 'bg', 'border', 'ring', 'fill', 'stroke', 'divide', 'decoration', 'outline', 'accent', 'shadow', 'from', 'to', 'via'];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return full.endsWith('.tsx') ? [full] : [];
  });
}

describe('classes de couleur', () => {
  const declared = declaredColors();

  it('déclare bien les tokens sémantiques attendus', () => {
    for (const name of ['page', 'card', 'fg', 'fg-muted', 'edge', 'accent', 'score-best']) {
      expect(declared, `token absent de tailwind.config.ts : ${name}`).toContain(name);
    }
  });

  it('n’utilise aucune couleur absente de la palette', () => {
    const orphans: string[] = [];
    const pattern = new RegExp(`\\b(?:${PREFIXES.join('|')})-([a-z][a-z0-9-]*)\\b`, 'g');

    for (const file of sourceFiles(path.join(process.cwd(), 'src'))) {
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(pattern)) {
        const name = match[1] as string;
        if (declared.has(name) || BUILT_IN.has(name)) continue;
        // On ne retient que ce qui ressemble à un nom de la palette v1 disparue.
        if (/^(abyss|sonde|best-line|danger|warn|paper|hairline|line|surface|raised|muted|dim|ink)/.test(name)) {
          orphans.push(`${path.relative(process.cwd(), file)} → ${match[0]}`);
        }
      }
    }

    expect(orphans, `classes pointant vers une couleur inexistante :\n${orphans.join('\n')}`).toEqual([]);
  });
});
