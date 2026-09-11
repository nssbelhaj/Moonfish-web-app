import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/*
  ────────────────────────────────────────────────────────────────────────────
   L'horodatage de construction doit avoir UNE SEULE source.

   Il est lu à deux endroits : l'en-tête de réponse, déclaré dans
   `next.config.ts`, et l'application, qui l'affiche dans le diagnostic. La
   première version appelait `new Date()` dans le module partagé — et Next
   charge sa configuration PLUSIEURS FOIS pendant une même construction. Les
   deux valeurs différaient donc d'une seconde, pendant que le diagnostic
   affirmait leur égalité.

   Mesuré : 07:53:50 dans l'en-tête contre 07:53:51 dans le diagnostic.

   Le shell le calcule maintenant une fois, avant `next build`. Ces tests
   interdisent de revenir en arrière.
  ────────────────────────────────────────────────────────────────────────────
*/

const CONFIG = readFileSync('next.config.ts', 'utf8');
const MODULE = readFileSync('src/lib/build-stamp.ts', 'utf8');
const PACKAGE = JSON.parse(readFileSync('package.json', 'utf8')) as {
  scripts: Record<string, string>;
};

describe('l’horodatage de construction', () => {
  it('n’est calculé NULLE PART dans le code : il est reçu', () => {
    for (const [nom, source] of [
      ['next.config.ts', CONFIG],
      ['src/lib/build-stamp.ts', MODULE],
    ] as const) {
      expect(
        source.replace(/\/\*[\s\S]*?\*\//g, ''),
        `${nom} calcule l’horodatage lui-même. Next charge sa configuration ` +
          'plusieurs fois par construction : chaque appel rendrait une valeur ' +
          'différente, et les deux lecteurs cesseraient de s’accorder.',
      ).not.toMatch(/new Date\(\)/);
    }
  });

  it('le script de construction le pose, une fois, avant `next build`', () => {
    expect(PACKAGE.scripts.build).toMatch(/^LUNA_BUILD=.*next build$/);
  });

  it('les deux lecteurs lisent la MÊME variable', () => {
    expect(CONFIG).toContain("process.env.LUNA_BUILD");
    expect(MODULE).toContain("process.env.LUNA_BUILD");
  });

  it('l’en-tête est servi sur toutes les routes, pas seulement les pages', () => {
    /*
      Le point de cet en-tête est de répondre sans compte et sans secret,
      depuis n'importe quelle URL. Le limiter aux pages obligerait à savoir
      laquelle interroger.
    */
    expect(CONFIG).toContain("source: '/:chemin*'");
    expect(CONFIG).toContain('x-luna-marea-build');
  });

  it('son absence est DITE, pas maquillée', () => {
    // `next build` lancé directement laisse la variable vide. Afficher alors
    // un horodatage inventé annulerait tout l'intérêt du dispositif.
    expect(MODULE).toContain("'inconnue'");
    expect(readFileSync('src/lib/diagnostic/etat.ts', 'utf8')).toContain("=== 'inconnue'");
  });
});
