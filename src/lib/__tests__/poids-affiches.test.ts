import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { FACTOR_WEIGHTS } from '@/lib/scoring';

/**
 * Les pondérations affichées doivent être celles que le moteur applique.
 *
 * La page d'accueil annonçait « Cinq facteurs — 35 / 25 / 20 / 15 / 5 ». Le
 * modèle en comptait six depuis l'arrivée de la pression, sept depuis celle de
 * l'eau, et aucun de ces chiffres n'était plus exact. Rien ne pouvait le
 * signaler : c'étaient des littéraux dans du JSX, cohérents avec eux-mêmes.
 *
 * Un site qui explique son calcul ne peut pas se tromper sur son propre
 * calcul — c'est la promesse qui le distingue d'une boîte noire.
 */
const RACINE = path.resolve(__dirname, '../../..');

describe('les pondérations publiées', () => {
  it('somment à 1 dans le moteur', () => {
    const somme = Object.values(FACTOR_WEIGHTS).reduce((t, p) => t + p, 0);
    expect(somme).toBeCloseTo(1, 10);
  });

  it('ne sont recopiées nulle part dans les pages', () => {
    // Un pourcentage écrit à la main à côté du mot « facteur » est la faute
    // qu'on cherche : elle survit à toute évolution du modèle.
    const accueil = readFileSync(path.join(RACINE, 'src/app/page.tsx'), 'utf8');
    expect(accueil).toContain('FACTOR_WEIGHTS[entree.facteur]');
    expect(accueil).not.toMatch(/weight:\s*\d+,/);
  });

  it('annoncent le bon NOMBRE de facteurs', () => {
    const combien = Object.keys(FACTOR_WEIGHTS).length;
    const mots = ['Quatre', 'Cinq', 'Six', 'Sept', 'Huit'];
    const attendu = mots[combien - 4];
    expect(attendu, `aucun mot pour ${combien} facteurs`).toBeDefined();

    const accueil = readFileSync(path.join(RACINE, 'src/app/page.tsx'), 'utf8');
    expect(accueil).toContain(`${attendu} facteurs`);
  });
});
