import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

import {
  anonymityStatement,
  missingPublisherFields,
  PUBLICATION_REGIME,
  PUBLISHER,
} from '@/data/legal';

/*
  ────────────────────────────────────────────────────────────────────────────
   L'article 6-III de la LCEN ne demande pas la même chose selon qui édite.
   Ces tests fixent la seule différence, pour qu'un basculement de régime ne
   puisse pas produire une page qui a l'air conforme sans l'être.
  ────────────────────────────────────────────────────────────────────────────
*/

describe('les mentions dues dans les DEUX régimes', () => {
  it.each(['name', 'email', 'publicationDirector'] as const)(
    '%s est renseigné',
    (champ) => {
      expect(PUBLISHER[champ], `${champ} est obligatoire quel que soit le régime`).not.toBeNull();
    },
  );
});

describe('la dispense d’adresse est conditionnelle', () => {
  it('sous le régime professionnel, l’adresse manquante est signalée', () => {
    if (PUBLICATION_REGIME !== 'professionnel') return;

    expect(anonymityStatement()).toBeNull();

    // Le bandeau doit réclamer l'adresse tant qu'elle manque : c'est la seule
    // chose qui empêche la page d'avoir l'air complète sans l'être.
    if (PUBLISHER.address === null) {
      expect(missingPublisherFields()).toContain('address');
    }
  });

  it('sous le régime non professionnel, l’absence d’adresse est EXPLIQUÉE, pas tue', () => {
    if (PUBLICATION_REGIME !== 'non-professionnel') return;

    expect(missingPublisherFields()).not.toContain('address');

    /*
      La dispense de l'alinéa 2 n'est acquise que si l'hébergeur détient
      l'identité de l'éditeur. Taire l'adresse SANS le dire ne serait pas une
      dispense, seulement une omission.
    */
    const phrase = anonymityStatement();
    expect(phrase).not.toBeNull();
    expect(phrase).toContain('non professionnel');
    expect(phrase).toContain('hébergeur');
  });
});

describe('la page suit la donnée', () => {
  it('n’écrit aucune identité en dur', () => {
    /*
      La faute classique de ces pages est la divergence : une adresse changée
      ici et pas là. La page doit LIRE `PUBLISHER`, jamais recopier sa valeur.
    */
    const page = readFileSync('src/app/mentions-legales/page.tsx', 'utf8');

    for (const valeur of [PUBLISHER.name, PUBLISHER.email, PUBLISHER.publicationDirector]) {
      if (valeur === null) continue;
      expect(page, `« ${valeur} » est écrit en dur dans la page`).not.toContain(valeur);
    }
  });
});
