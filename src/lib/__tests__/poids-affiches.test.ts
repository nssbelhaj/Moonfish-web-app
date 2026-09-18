import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  FACTOR_COUNT_WORD,
  FACTOR_SUBJECTS,
  FACTOR_WEIGHTS,
  FACTORS_BY_WEIGHT,
  factorWeightSentence,
} from '@/lib/scoring';

/**
 * Les pondérations affichées doivent être celles que le moteur applique.
 *
 * La page d'accueil annonçait « Cinq facteurs — 35 / 25 / 20 / 15 / 5 », et sa
 * FAQ répétait la même phrase. Le modèle en comptait six depuis l'arrivée de
 * la pression, sept depuis celle de l'eau, et aucun de ces chiffres n'était
 * plus exact. Rien ne pouvait le signaler : c'étaient des littéraux dans du
 * JSX, cohérents avec eux-mêmes pour toujours.
 *
 * Un site qui explique son calcul ne peut pas se tromper sur son propre
 * calcul — c'est la promesse qui le distingue d'une boîte noire.
 */
const RACINE = path.resolve(__dirname, '../../..');
const ACCUEIL = readFileSync(path.join(RACINE, 'src/app/page.tsx'), 'utf8');

/** Le JSX, débarrassé de ses commentaires : seul le texte RENDU compte. */
const ACCUEIL_SANS_COMMENTAIRES = ACCUEIL.replace(/\/\*[\s\S]*?\*\//g, '');

describe('les pondérations publiées', () => {
  it('somment à 1 dans le moteur', () => {
    const somme = Object.values(FACTOR_WEIGHTS).reduce((t, p) => t + p, 0);
    expect(somme).toBeCloseTo(1, 10);
  });

  it('couvrent tous les facteurs, sans doublon', () => {
    expect(new Set(FACTORS_BY_WEIGHT).size).toBe(FACTORS_BY_WEIGHT.length);
    expect(FACTORS_BY_WEIGHT.length).toBe(Object.keys(FACTOR_WEIGHTS).length);
  });

  it('classent du plus lourd au plus léger', () => {
    const poids = FACTORS_BY_WEIGHT.map((facteur) => FACTOR_WEIGHTS[facteur]);
    expect(poids).toStrictEqual([...poids].sort((a, b) => b - a));
  });
});

describe('la phrase qui énumère les poids', () => {
  it('cite chaque facteur avec son pourcentage', () => {
    const phrase = factorWeightSentence();
    for (const facteur of FACTORS_BY_WEIGHT) {
      const attendu = `${FACTOR_SUBJECTS[facteur]} pour ${Math.round(FACTOR_WEIGHTS[facteur] * 100)} %`;
      expect(phrase, `${facteur} absent ou mal pondéré`).toContain(attendu);
    }
  });

  it('annonce le bon nombre de facteurs, en toutes lettres', () => {
    const mots: Record<number, string> = {
      3: 'Trois',
      4: 'Quatre',
      5: 'Cinq',
      6: 'Six',
      7: 'Sept',
      8: 'Huit',
      9: 'Neuf',
      10: 'Dix',
    };
    expect(FACTOR_COUNT_WORD).toBe(mots[FACTORS_BY_WEIGHT.length]);
  });
});

describe('la page d’accueil ne recopie aucun de ces chiffres', () => {
  it('lit les poids dans le moteur', () => {
    expect(ACCUEIL).toContain('FACTOR_WEIGHTS[facteur]');
    expect(ACCUEIL).toContain('factorWeightSentence()');
    expect(ACCUEIL).toContain('FACTOR_COUNT_WORD');
  });

  it('n’écrit « N facteurs » nulle part à la main', () => {
    /*
      C'est la faute exacte qui a survécu six mois : le chapô de la section
      disait « Sept facteurs » — corrigé — tandis que la FAQ, douze lignes
      plus bas, disait encore « Cinq facteurs pondérés ». Les deux étaient
      des littéraux, et le test d'alors ne vérifiait que le premier.
    */
    const fautes = ACCUEIL_SANS_COMMENTAIRES.match(
      /\b(Trois|Quatre|Cinq|Six|Sept|Huit|Neuf|Dix|\d+)\s+facteurs/gi,
    );
    expect(fautes, `nombre de facteurs écrit en dur : ${fautes?.join(', ')}`).toBeNull();
  });

  it('n’écrit aucun poids en dur à côté d’un facteur', () => {
    const fautes = ACCUEIL_SANS_COMMENTAIRES.match(/pour\s+\d+\s*%/g);
    expect(fautes, `pondération écrite en dur : ${fautes?.join(', ')}`).toBeNull();
    expect(ACCUEIL_SANS_COMMENTAIRES).not.toMatch(/weight:\s*\d+,/);
  });
});
