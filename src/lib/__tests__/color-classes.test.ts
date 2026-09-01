import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Deux invariants d'USAGE, que ni le compilateur ni le test de contraste des
 * tokens ne peuvent attraper.
 */
const CONFIG = readFileSync(path.join(process.cwd(), 'tailwind.config.ts'), 'utf8');

function declaredColors(): Set<string> {
  const block = CONFIG.slice(CONFIG.indexOf('colors: {'), CONFIG.indexOf('fontFamily:'));
  const names = new Set<string>();
  for (const match of block.matchAll(/^\s*'?([a-z0-9-]+)'?:/gm)) names.add(match[1] as string);
  for (const tier of [1, 2, 3, 4]) names.add(`score-${tier}`);
  return names;
}

const BUILT_IN = new Set(['transparent', 'current', 'inherit', 'white', 'black']);
const PREFIXES = ['text', 'bg', 'border', 'ring', 'fill', 'stroke', 'divide', 'decoration', 'outline'];

/** Vocabulaire du handoff v1, supprimé : toute survivance est un no-op silencieux. */
const RETIRED = /^(abyss|surface|raised|line|muted|dim|paper|hairline|sonde|night|best-bg|alert|vigil|ok-(bg|line)|accent$|score-(bad|mid|good|best)|fg-dim|card-raised|ink-)/;

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return sources(full);
    return full.endsWith('.tsx') ? [full] : [];
  });
}

describe('classes de couleur', () => {
  const declared = declaredColors();
  const files = sources(path.join(process.cwd(), 'src'));

  it('déclare les tokens sémantiques du handoff v3', () => {
    for (const name of ['page', 'card', 'surface-2', 'edge', 'edge-strong', 'water', 'accent', 'fg', 'fg-muted', 'fg-on-accent', 'danger', 'warn']) {
      expect(declared, `token absent de tailwind.config.ts : ${name}`).toContain(name);
    }
  });

  /**
   * Motivé par un vrai bug : après le renommage de la palette, un bouton portait
   * encore `text-abyss`. Tailwind ne génère alors AUCUNE règle — la classe
   * devient un no-op silencieux, le texte hérite de la couleur du parent, et le
   * bouton descend à 1,62:1. Ni tsc, ni ESLint, ni le contraste des tokens ne
   * pouvaient le voir.
   */
  it('n’utilise aucune couleur retirée de la palette', () => {
    const orphans: string[] = [];
    const pattern = new RegExp(`\\b(?:${PREFIXES.join('|')})-([a-z][a-z0-9-]*)\\b`, 'g');

    for (const file of files) {
      for (const match of readFileSync(file, 'utf8').matchAll(pattern)) {
        const name = match[1] as string;
        if (declared.has(name) || BUILT_IN.has(name)) continue;
        if (RETIRED.test(name)) orphans.push(`${path.relative(process.cwd(), file)} → ${match[0]}`);
      }
    }

    expect(orphans, `classes pointant vers une couleur retirée :\n${orphans.join('\n')}`).toEqual([]);
  });

  /**
   * `fg-faint` mesure 4,13:1 sur `chip` — sous le plancher AA. Le handoff ne
   * garantit ce token que jusqu'à `card-2`. La règle est donc : jamais de texte
   * faint sur une surface chip. Elle ne peut se vérifier qu'à l'usage.
   */
  it('ne pose jamais de texte fg-faint sur une surface chip', () => {
    const offenders: string[] = [];

    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)) {
        const classes = match[1] ?? match[2] ?? '';
        if (classes.includes('bg-chip') && classes.includes('text-fg-faint')) {
          offenders.push(`${path.relative(process.cwd(), file)} → ${classes.slice(0, 90)}`);
        }
      }
    }

    expect(offenders, `contraste sous AA :\n${offenders.join('\n')}`).toEqual([]);
  });
});

/**
 * Encres autorisées SUR `surface-2`.
 *
 * `contrast.test.ts` établit la règle au niveau des tokens : sur les deux
 * thèmes, seuls `fg` et `accent` tiennent AA sur cette surface de remplissage.
 * Mais rien ne l'appliquait aux COMPOSANTS — et huit éléments réels portaient
 * `text-fg-muted` sur `bg-chip`, mesurés à 3,68:1 en thème nuit.
 *
 * C'est le même angle mort que `text-abyss` en v2 : une règle vraie, écrite,
 * testée au bon endroit, et contournée à l'usage sans que rien ne le voie.
 */
describe('encres sur surface-2', () => {
  const files = sources(path.join(process.cwd(), 'src'));
  const ALLOWED = new Set(['fg', 'accent', 'fg-on-accent', 'danger']);
  // `text-` sert aussi aux tailles (`text-body`, `text-meta`) : seules les
  // classes dont le nom est une COULEUR déclarée nous intéressent ici.
  const colours = declaredColors();

  it('n’y pose que ce qui y tient', () => {
    const offenders: string[] = [];

    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      // On inspecte chaque littéral de classe contenant bg-surface-2 : c'est
      // l'unité que Tailwind applique réellement à un élément.
      for (const match of text.matchAll(/(?:className|class)=\{?["'`]([^"'`]*bg-surface-2[^"'`]*)["'`]/g)) {
        const classes = (match[1] as string).split(/\s+/);
        for (const cls of classes) {
          const ink = /^text-([a-z][a-z0-9-]*)$/.exec(cls)?.[1];
          if (ink && colours.has(ink) && !ALLOWED.has(ink)) {
            offenders.push(`${path.relative(process.cwd(), file)} → ${cls} sur bg-surface-2`);
          }
        }
      }
    }

    expect(
      offenders,
      'encre non autorisée sur surface-2 : elle n’y tient pas AA en thème nuit',
    ).toStrictEqual([]);
  });

  it('ne laisse plus traîner les anciens noms de surface', () => {
    // `chip` et `card-2` sont les noms du v2. Ils restent définis le temps de la
    // migration, mais plus rien ne doit les employer — sinon la liste des
    // hérités ne diminue jamais et le bloc d'alias devient permanent.
    const offenders: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      for (const match of text.matchAll(/\b(?:bg|text|border)-(chip|card-2)\b/g)) {
        offenders.push(`${path.relative(process.cwd(), file)} → ${match[0]}`);
      }
    }
    expect(offenders).toStrictEqual([]);
  });
});
