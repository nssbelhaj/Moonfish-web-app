import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Deux éléments ne peuvent pas porter le même identifiant.
 *
 * Écrit après avoir donné `id="avis"` À LA FOIS à une section et à son titre.
 * Les conséquences sont silencieuses : `aria-labelledby` résout le premier
 * élément rencontré — donc, ici, la section entière au lieu de son titre — et
 * le saut vers « #avis » dépend du navigateur. Rien ne l'affiche, ni en
 * développement, ni au build ; seul un outil qui cherche les doublons le voit.
 *
 * Le balayage est volontairement simple : les `id` littéraux d'un même
 * fichier. Un identifiant construit à l'exécution (`id={`x-${i}`}`) lui
 * échappe, et c'est assumé — il attrape la faute qu'on commet vraiment, celle
 * de recopier une chaîne.
 */
const RACINE = path.resolve(__dirname, '../../..');

function fichiers(dossier: string): string[] {
  const trouves: string[] = [];
  for (const nom of readdirSync(dossier)) {
    const chemin = path.join(dossier, nom);
    if (statSync(chemin).isDirectory()) {
      if (nom !== '__tests__') trouves.push(...fichiers(chemin));
    } else if (nom.endsWith('.tsx')) {
      trouves.push(chemin);
    }
  }
  return trouves;
}

describe('les identifiants HTML', () => {
  it('ne sont jamais posés deux fois dans un même fichier', () => {
    const fautifs: string[] = [];

    for (const fichier of [
      ...fichiers(path.join(RACINE, 'src/app')),
      ...fichiers(path.join(RACINE, 'src/components')),
    ]) {
      const source = readFileSync(fichier, 'utf8');
      const vus = new Map<string, number>();

      for (const m of source.matchAll(/\bid="([a-zA-Z][\w-]*)"/g)) {
        const id = m[1];
        if (id === undefined) continue;
        vus.set(id, (vus.get(id) ?? 0) + 1);
      }

      for (const [id, combien] of vus) {
        if (combien > 1) fautifs.push(`${path.relative(RACINE, fichier)} → id="${id}" ×${combien}`);
      }
    }

    expect(fautifs, 'identifiant HTML posé plusieurs fois').toStrictEqual([]);
  });
});
