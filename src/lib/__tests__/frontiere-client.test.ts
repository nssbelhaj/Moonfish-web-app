import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/*
  ────────────────────────────────────────────────────────────────────────────
   Un composant client ne doit atteindre AUCUN module qui importe `node:`.

   Le build le refuse — « Reading from "node:crypto" is not handled by
   plugins » — mais il le refuse à la fin, après plusieurs minutes, avec une
   trace qui nomme le module Node et pas la raison. C'est arrivé en ajoutant
   les formulaires de compte : ils importaient une simple constante de
   longueur depuis le module qui sait hacher les mots de passe, et tout le
   module serait parti dans le navigateur.

   Ce test rend le même verdict en quelques millisecondes, et dit POURQUOI.
  ────────────────────────────────────────────────────────────────────────────
*/

const RACINE = process.cwd();
const SRC = path.join(RACINE, 'src');

function fichiers(dossier: string): string[] {
  return readdirSync(dossier, { withFileTypes: true }).flatMap((entree) => {
    const complet = path.join(dossier, entree.name);
    if (entree.isDirectory()) return entree.name === '__tests__' ? [] : fichiers(complet);
    return /\.(ts|tsx)$/.test(entree.name) ? [complet] : [];
  });
}

const TOUS = fichiers(SRC);

/** Résout un import `@/…` ou relatif vers un fichier réel. */
function resoudre(depuis: string, specificateur: string): string | null {
  const base = specificateur.startsWith('@/')
    ? path.join(SRC, specificateur.slice(2))
    : specificateur.startsWith('.')
      ? path.resolve(path.dirname(depuis), specificateur)
      : null;

  if (base === null) return null;

  for (const suffixe of ['.ts', '.tsx', '/index.ts', '/index.tsx']) {
    const candidat = `${base}${suffixe}`;
    if (TOUS.includes(candidat)) return candidat;
  }
  return TOUS.includes(base) ? base : null;
}

/**
 * Imports qui existent encore À L'EXÉCUTION.
 *
 * `import type { X } from '…'` est effacé à la compilation : il ne fait
 * charger aucun module et ne peut donc rien entraîner dans le navigateur. Le
 * projet impose cette forme (`verbatimModuleSyntax`), et ne pas la distinguer
 * accusait deux composants qui se contentent d'importer un type.
 */
function importsDe(fichier: string): string[] {
  const source = readFileSync(fichier, 'utf8');

  return [...source.matchAll(/^import\s+(type\s+)?[^;]*?from\s+'([^']+)'/gm)]
    .filter((m) => m[1] === undefined)
    .map((m) => m[2]!);
}

/**
 * Un module « use server » ARRÊTE la traversée.
 *
 * Next.js ne l'envoie pas au navigateur : il remplace l'import par un appel
 * distant. Ce qu'un fichier d'actions importe — la base, la cryptographie —
 * reste donc côté serveur, et c'est tout l'intérêt du procédé.
 *
 * Une première version de ce test l'ignorait et accusait cinq composants
 * parfaitement corrects, dont ceux qui marchaient déjà en production.
 */
function estModuleServeur(fichier: string): boolean {
  return readFileSync(fichier, 'utf8').startsWith("'use server'");
}

/** Chemin depuis un composant client jusqu'à un module `node:`, s'il en existe un. */
function cheminVersNode(depart: string): string[] | null {
  const vus = new Set<string>();
  const pile: { fichier: string; chemin: string[] }[] = [{ fichier: depart, chemin: [depart] }];

  while (pile.length > 0) {
    const { fichier, chemin } = pile.pop()!;
    if (vus.has(fichier)) continue;
    vus.add(fichier);

    for (const specificateur of importsDe(fichier)) {
      if (specificateur.startsWith('node:')) return [...chemin, specificateur];

      const suivant = resoudre(fichier, specificateur);
      if (suivant === null) continue;

      // La frontière serveur est franchie par un appel distant, pas par un
      // paquet : ce qui est au-delà ne part jamais dans le navigateur.
      if (estModuleServeur(suivant)) continue;

      pile.push({ fichier: suivant, chemin: [...chemin, suivant] });
    }
  }

  return null;
}

const CLIENTS = TOUS.filter((f) => readFileSync(f, 'utf8').startsWith("'use client'"));

describe('la frontière client / serveur', () => {
  it('il existe bien des composants client à vérifier', () => {
    // Sans cela, le test passerait en n'ayant rien examiné.
    expect(CLIENTS.length).toBeGreaterThan(10);
  });

  it.each(CLIENTS.map((f) => [path.relative(RACINE, f), f] as const))(
    '%s n’atteint aucun module `node:`',
    (nom, fichier) => {
      const chemin = cheminVersNode(fichier);

      expect(
        chemin === null,
        chemin === null
          ? ''
          : `« ${nom} » atteint un module Node par cette chaîne :\n\n` +
            chemin.map((e) => `  ${path.relative(RACINE, e)}`).join('\n →') +
            '\n\nLe build échouera. Sortez ce dont le composant a besoin dans un ' +
            'module sans dépendance à Node — les constantes et les types ne ' +
            'coûtent rien à déplacer.',
      ).toBe(true);
    },
  );
});
