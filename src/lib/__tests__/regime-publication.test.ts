import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

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

  /**
   * Marqueurs d'une recette écrite À LA MAIN, que l'inspection des dépendances
   * ne peut pas voir : un lien d'affiliation ou un bouton de don est du texte
   * dans un composant, pas un paquet installé.
   */
  const LIENS = [
    'buymeacoffee.com',
    'ko-fi.com',
    'patreon.com',
    'tipeee.com',
    'paypal.me',
    'amzn.to',
    'amazon.fr/dp',
    'amazon.com/dp',
    'awin1.com',
    'shareasale.com',
    'tradedoubler',
    'affilae',
    'utm_medium=affiliate',
    'tag=lunamarea',
  ];

  it('aucun lien d’affiliation ni bouton de don dans les sources', () => {
    if (PUBLICATION_REGIME !== 'non-professionnel') return;

    const trouves: string[] = [];

    const parcourir = (dossier: string): void => {
      for (const entree of readdirSync(dossier, { withFileTypes: true })) {
        const chemin = join(dossier, entree.name);
        if (entree.isDirectory()) {
          if (entree.name !== '__tests__') parcourir(chemin);
          continue;
        }
        if (!/\.(ts|tsx|md)$/.test(entree.name)) continue;

        const source = readFileSync(chemin, 'utf8').toLowerCase();
        for (const marqueur of LIENS) {
          if (source.includes(marqueur)) trouves.push(`${chemin} → ${marqueur}`);
        }
      }
    };

    parcourir('src');

    expect(
      trouves,
      `${trouves.join(', ')}\n\n` +
        'Un lien d’affiliation ou un bouton de don rémunéré rend le site COMMERCIAL. ' +
        'Trois choses changent en même temps, et les oublier coûte cher :\n' +
        '  1. PUBLICATION_REGIME passe à « professionnel », et PUBLISHER.address ' +
        'redevient obligatoire (art. 6-III-1 de la LCEN) ;\n' +
        '  2. la plupart des programmes d’affiliation imposent une mention visible ' +
        'de la relation commerciale sur les pages concernées ;\n' +
        '  3. si le lien dépose un cookie ou charge une ressource tierce, la page ' +
        'de confidentialité — qui affirme aujourd’hui n’en poser AUCUN — devient ' +
        'fausse, et un recueil de consentement devient nécessaire.',
    ).toStrictEqual([]);
  });

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
