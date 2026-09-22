import { describe, expect, it } from 'vitest';

import { MAILLE_REFERENCES } from '@/data/species';
import { FICHES_PAYS, especesPhares, ficheDe, paysDe, paysPath, prepositionDe } from '@/data/pays';
import { PAYS } from '@/data/spots';

/**
 * Une page pays sans fiche serait un filtre déguisé en page. Et une fiche qui
 * affirmerait un chiffre que `species.ts` dit ne pas avoir vérifié serait
 * une contradiction entre deux pages du même site.
 */
describe('les fiches pays', () => {
  it('existent pour CHAQUE pays du catalogue', () => {
    for (const pays of PAYS) {
      expect(() => ficheDe(pays.slug), `fiche manquante : ${pays.slug}`).not.toThrow();
      expect(ficheDe(pays.slug).slug).toBe(pays.slug);
    }
  });

  it('lèvent sur un pays inconnu plutôt que de rendre une fiche vide', () => {
    expect(() => ficheDe('narnia')).toThrow();
    expect(paysDe('narnia')).toBeNull();
  });

  it('couvrent toutes les façades des spots du pays, et aucune autre', () => {
    for (const pays of PAYS) {
      const attendues = new Set(pays.spots.map((spot) => spot.sea));
      const decrites = new Set(ficheDe(pays.slug).facades.map((f) => f.sea));
      expect(decrites, `façades de ${pays.slug}`).toStrictEqual(attendues);
    }
  });

  it('n’affichent aucun chiffre de maille là où species.ts dit ne pas l’avoir vérifié', () => {
    /*
      `MAILLE_REFERENCES[pays].label === null` veut dire « nos données ne
      couvrent pas ce pays ». La fiche du même pays ne peut alors pas écrire
      « 36 cm » : deux pages du site se contrediraient, et la plus affirmative
      serait celle sans source.
    */
    for (const pays of PAYS) {
      const reference = MAILLE_REFERENCES[pays.slug];
      if (reference?.label !== null) continue;
      const texte = ficheDe(pays.slug).reglementation.resume;
      expect(texte, `${pays.slug} affiche une maille chiffrée`).not.toMatch(/\d+\s*cm/);
    }
  });

  it('renvoient vers la même autorité que species.ts', () => {
    for (const pays of PAYS) {
      const reference = MAILLE_REFERENCES[pays.slug];
      if (!reference) continue;
      expect(ficheDe(pays.slug).reglementation.url).toBe(reference.url);
    }
  });

  it('portent une date de relecture lisible', () => {
    for (const fiche of Object.values(FICHES_PAYS)) {
      expect(fiche.reglementation.relu).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(new Date(fiche.reglementation.relu).getTime())).toBe(false);
    }
  });

  it('donnent un code ISO distinct par pays', () => {
    const codes = Object.values(FICHES_PAYS).map((fiche) => fiche.iso);
    expect(new Set(codes).size).toBe(codes.length);
  });
});

describe('les dérivés du catalogue', () => {
  it('classent les espèces par nombre de spots qui les citent', () => {
    for (const pays of PAYS) {
      const phares = especesPhares(pays, 6);
      expect(phares.length).toBeGreaterThan(0);
      expect(phares.length).toBeLessThanOrEqual(6);
      for (let i = 1; i < phares.length; i += 1) {
        expect(phares[i - 1]!.spots).toBeGreaterThanOrEqual(phares[i]!.spots);
      }
      for (const { nom, spots } of phares) {
        expect(pays.spots.filter((spot) => spot.species.includes(nom))).toHaveLength(spots);
      }
    }
  });

  it('donnent la bonne préposition et le bon chemin', () => {
    expect(prepositionDe({ slug: 'maroc', nom: 'Maroc' })).toBe('au Maroc');
    expect(prepositionDe({ slug: 'france', nom: 'France' })).toBe('en France');
    expect(prepositionDe({ slug: 'inconnu', nom: 'Inconnu' })).toBe('en Inconnu');
    expect(paysPath('maroc')).toBe('/spots/maroc');
  });
});
