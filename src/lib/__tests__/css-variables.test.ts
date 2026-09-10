import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Toute `var(--x)` écrite dans un composant doit exister.
 *
 * Ce test comble le dernier angle mort de la palette. `color-classes.test.ts`
 * surveille les CLASSES Tailwind retirées ; rien ne surveillait les variables
 * CSS employées en style inline ou en attribut SVG — or elles échouent encore
 * plus silencieusement : `fill="var(--best-bg)"` sur une variable inexistante ne
 * produit ni erreur de compilation, ni avertissement du navigateur. La forme
 * est simplement peinte en noir, ou pas peinte du tout.
 *
 * Au moment de son écriture il a trouvé six variables mortes, dont trois
 * (`--best-bg`, `--card-raised`, `--fg-dim`) traînaient depuis le handoff v1 :
 * personne ne les avait vues en deux refontes.
 */
const TOKENS = readFileSync(path.join(process.cwd(), 'src/app/tokens.css'), 'utf8');
const GLOBALS = readFileSync(path.join(process.cwd(), 'src/app/globals.css'), 'utf8');
const LAYOUT = readFileSync(path.join(process.cwd(), 'src/app/layout.tsx'), 'utf8');

/** Variables déclarées dans tokens.css, plus celles injectées par next/font. */
function declared(): Set<string> {
  const names = new Set<string>();
  for (const m of TOKENS.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gm)) names.add(m[1] as string);
  // `next/font` déclare ses variables sur <html> : elles sont légitimes.
  for (const m of LAYOUT.matchAll(/variable:\s*'(--[a-z0-9-]+)'/g)) names.add(m[1] as string);
  return names;
}

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return sources(full);
    return /\.(tsx?|css)$/.test(full) && !full.includes('__tests__') ? [full] : [];
  });
}

describe('variables CSS', () => {
  const known = declared();

  it('déclare toutes celles employées par les composants et les feuilles', () => {
    const orphans: string[] = [];
    const files = [...sources(path.join(process.cwd(), 'src'))];

    for (const file of files) {
      if (file.endsWith('tokens.css')) continue;
      const text = file.endsWith('globals.css') ? GLOBALS : readFileSync(file, 'utf8');
      for (const m of text.matchAll(/var\((--[a-z0-9-]+)/g)) {
        const name = m[1] as string;
        if (!known.has(name)) orphans.push(`${path.relative(process.cwd(), file)} → var(${name})`);
      }
    }

    expect(
      [...new Set(orphans)],
      'variables employées mais jamais déclarées : la règle est silencieusement ignorée',
    ).toStrictEqual([]);
  });

  it('ne déclare aucun token sémantique que personne n’emploie', () => {
    // L'inverse compte aussi : un token orphelin donne l'illusion d'une palette
    // plus riche qu'elle ne l'est, et le prochain qui l'emploie découvre qu'il
    // n'a jamais été vérifié nulle part.
    const usage = sources(path.join(process.cwd(), 'src'))
      .map((f) => readFileSync(f, 'utf8'))
      .join('\n');

    const SEMANTIC = [
      'page', 'card', 'surface-2', 'edge', 'edge-strong', 'water', 'accent',
      'fg', 'fg-muted', 'fg-on-accent', 'danger', 'warn', 'focus',
      'score-1', 'score-2', 'score-3', 'score-4',
    ];
    const unused = SEMANTIC.filter(
      (name) => !usage.includes(`var(--${name})`) && !usage.includes(`-${name}`) && !usage.includes(`"${name}"`),
    );
    expect(unused, 'tokens déclarés mais employés nulle part').toStrictEqual([]);
  });
});

describe('le contrôle segmenté du compte', () => {
  const CSS = readFileSync('src/app/globals.css', 'utf8');

  it('replie « créer un compte » PAR DÉFAUT, pas seulement après un clic', () => {
    /*
      Une première version n'affichait un panneau seul qu'APRÈS un clic : au
      chargement, les deux formulaires se suivaient sur toute la largeur, et
      on ne savait pas lequel remplir.
    */
    expect(CSS).toMatch(/\.onglets-compte #inscription-panneau \{\s*display: none;/);
  });

  it('enferme TOUTE la bascule dans `@supports selector(:has(*))`', () => {
    /*
      Sans cette garde, un navigateur sans `:has()` masquerait l'inscription
      définitivement — sans jamais pouvoir la ramener. Une page longue vaut
      mieux qu'un formulaire inatteignable.
    */
    // On vise la RÈGLE, pas le commentaire qui la cite : sans l'accolade,
    // `indexOf` tombait sur l'explication écrite plus haut.
    const bloc = CSS.slice(CSS.indexOf('@supports selector(:has(*)) {'));
    const fin = bloc.indexOf('\n}\n', bloc.lastIndexOf('.onglets-compte'));

    expect(bloc).toContain('#inscription-panneau');
    // La règle de masquage par défaut est DANS le bloc `@supports`.
    expect(bloc.slice(0, fin)).toMatch(/\.onglets-compte #inscription-panneau \{\s*display: none;/);
  });

  it('n’écrit aucune ombre littérale : elle vient d’un jeton', () => {
    const bloc = CSS.slice(CSS.indexOf('.segments-compte'));

    expect(bloc).toContain('var(--ombre-controle)');
    expect(bloc).not.toMatch(/box-shadow:[^;]*rgb\(/);
  });
});
