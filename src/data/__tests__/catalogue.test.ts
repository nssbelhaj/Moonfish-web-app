import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { CATALOGUE, SPOTS } from '../spots';

/**
 * Le nombre de spots a été écrit en dur — « 12 spots » — dans neuf endroits
 * du site, et il y est resté après le passage à quarante-deux. Un chiffre
 * recopié est un chiffre périmé en attente. Ce test relit les sources et
 * refuse tout nombre de spots écrit à la main dans un texte visible.
 */

const RACINE = path.resolve(__dirname, '../../..');

function fichiers(dossier: string): string[] {
  const resultat: string[] = [];
  for (const nom of readdirSync(dossier)) {
    const chemin = path.join(dossier, nom);
    if (statSync(chemin).isDirectory()) {
      if (nom !== '__tests__' && nom !== 'node_modules') resultat.push(...fichiers(chemin));
    } else if (/\.(tsx?|md)$/.test(nom)) {
      resultat.push(chemin);
    }
  }
  return resultat;
}

describe('la taille du catalogue', () => {
  it('se calcule, elle ne se recopie pas', () => {
    expect(CATALOGUE.total).toBe(SPOTS.length);
    expect(CATALOGUE.total).toBeGreaterThan(12);
  });

  it('n’est écrite en dur dans aucun texte visible', () => {
    const fautifs: string[] = [];

    for (const fichier of fichiers(path.join(RACINE, 'src/app')).concat(fichiers(path.join(RACINE, 'src/components')))) {
      const source = readFileSync(fichier, 'utf8');
      // Un nombre littéral suivi de « spots » dans un texte, hors gabarit
      // `${…}` et hors accolades JSX — c'est ce que quelqu'un a tapé à la main.
      for (const ligne of source.split('\n')) {
        const t = ligne.trim();
        if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) continue;
        if (/(?<![{$\w])\b\d{1,3} spots?\b/.test(ligne) && !/\$\{|\{[^}]*\.(total|length)\}/.test(ligne)) {
          fautifs.push(`${path.relative(RACINE, fichier)} : ${ligne.trim()}`);
        }
      }
    }

    expect(fautifs, 'nombre de spots écrit en dur').toStrictEqual([]);
  });
});
