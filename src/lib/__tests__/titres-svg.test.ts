import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Un `<title>` ne prend qu'UNE chaîne.
 *
 * React 19 exige qu'un `<title>` — dans un SVG comme ailleurs — ait pour
 * enfant une chaîne unique. Avec plusieurs enfants (`{nom} — {region}`), le
 * rendu SERVEUR le vide en silence tandis que le client rend le texte : le
 * HTML servi ne correspond plus au DOM attendu, et la page entière se
 * réhydrate à blanc avec l'erreur #418, sans autre indice en production.
 *
 * C'est arrivé sur les pages pays, et seule une comparaison du HTML servi au
 * DOM l'a montré. Ce test le refuse à la source.
 */
const RACINE = path.resolve(__dirname, '../../..');

function fichiersTsx(dir: string): string[] {
  return readdirSync(dir).flatMap((entree) => {
    const complet = path.join(dir, entree);
    if (statSync(complet).isDirectory()) return fichiersTsx(complet);
    return complet.endsWith('.tsx') ? [complet] : [];
  });
}

describe('les <title> JSX', () => {
  it('n’ont qu’un seul enfant, jamais un mélange de texte et d’expressions', () => {
    const fautes: string[] = [];

    for (const fichier of fichiersTsx(path.join(RACINE, 'src'))) {
      // Les commentaires sont retirés d'abord : celui qui explique cette règle
      // cite lui-même un `<title>` vide, et se ferait prendre.
      const source = readFileSync(fichier, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
      for (const match of source.matchAll(/<title(?:\s[^>]*)?>([\s\S]*?)<\/title>/g)) {
        const contenu = (match[1] ?? '').trim();
        // Un seul `{…}` sans texte autour, ou du texte seul : acceptés.
        const expressions = contenu.match(/\{/g)?.length ?? 0;
        const texteHorsExpressions = contenu.replace(/\{[\s\S]*?\}/g, '').trim();
        if (expressions > 1 || (expressions === 1 && texteHorsExpressions.length > 0)) {
          fautes.push(`${path.relative(RACINE, fichier)} : <title>${contenu.slice(0, 60)}…`);
        }
      }
    }

    expect(fautes, fautes.join('\n')).toStrictEqual([]);
  });
});
