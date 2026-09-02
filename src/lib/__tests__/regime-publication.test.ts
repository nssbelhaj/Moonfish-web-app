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

/*
  ────────────────────────────────────────────────────────────────────────────
   Le régime non professionnel se PÉRIME, et c'est son danger.

   Il est juste tant que le site ne rapporte rien. Il devient faux — et se
   déclarer ainsi devient une infraction — le jour où une régie publicitaire
   ou un encaissement apparaît. Or ce jour-là, personne ne pense aux mentions
   légales : on pense à faire marcher le paiement.

   Ce test attache donc la bascule à un fait vérifiable plutôt qu'au souvenir
   qu'on en a. Il ne prétend pas détecter toute forme de recette : un lien
   d'affiliation écrit à la main lui échappe. Il attrape ce qui laisse une
   trace dans les dépendances, c'est-à-dire l'écrasante majorité des cas.
  ────────────────────────────────────────────────────────────────────────────
*/
describe('le régime non professionnel ne survit pas à une monétisation', () => {
  /** Bibliothèques dont la seule raison d'être est d'encaisser ou d'afficher de la publicité. */
  const MONETISATION = [
    'stripe',
    'paypal',
    'braintree',
    'lemonsqueezy',
    'paddle',
    'adsense',
    'google-adsense',
    'react-adsense',
    'gpt-ads',
    'prebid',
    'sumup',
    'mollie',
    'revolut',
  ];

  it('aucune dépendance de paiement ou de régie tant que le régime l’exclut', () => {
    if (PUBLICATION_REGIME !== 'non-professionnel') return;

    const pkg: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> } =
      JSON.parse(readFileSync('package.json', 'utf8'));

    const installees = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
    const trouvees = installees.filter((nom) =>
      MONETISATION.some((marqueur) => nom.toLowerCase().includes(marqueur)),
    );

    expect(
      trouvees,
      `« ${trouvees.join(', ')} » indique une recette. Le site n’est alors plus édité à ` +
        'titre non professionnel : passez PUBLICATION_REGIME à « professionnel » et ' +
        'renseignez PUBLISHER.address, que la LCEN redevient en droit d’exiger.',
    ).toStrictEqual([]);
  });
});
