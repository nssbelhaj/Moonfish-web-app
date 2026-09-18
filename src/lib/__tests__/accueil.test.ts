import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { PAYS } from '@/data/spots';
import { CLIENT_STORAGE } from '@/data/legal';
import { CLE_PAYS } from '@/components/accueil/ChoixPays';

/**
 * Le contrat de la page d'accueil, qu'aucun rendu unitaire ne peut voir.
 *
 * Le sélecteur de pays masque des blocs rendus par le SERVEUR, en les
 * retrouvant par `[data-pays]`. Les deux moitiés vivent dans deux fichiers,
 * ne s'importent pas l'une l'autre, et rien dans le typage ne les relie :
 * renommer l'attribut d'un côté laisse l'autre compiler, passer les tests, et
 * afficher les trois pays quoi qu'on clique.
 *
 * C'est exactement la classe de panne que cette session a rencontrée trois
 * fois — spécificité CSS, champ de formulaire oublié, chemin de
 * revalidation — invisible aux tests unitaires, visible en deux secondes
 * dans un navigateur. Faute de pouvoir rendre la page ici, on attache au
 * moins les deux moitiés l'une à l'autre.
 */
const RACINE = path.resolve(__dirname, '../../..');
const ACCUEIL = readFileSync(path.join(RACINE, 'src/app/page.tsx'), 'utf8');
const SELECTEUR = readFileSync(
  path.join(RACINE, 'src/components/accueil/ChoixPays.tsx'),
  'utf8',
);

describe('le masquage par pays', () => {
  it('emploie le même attribut des deux côtés', () => {
    expect(ACCUEIL, 'la page ne marque plus ses blocs').toContain('data-pays={pays.slug}');
    expect(SELECTEUR, 'le sélecteur ne cherche plus les blocs').toContain("'[data-pays]'");
    expect(SELECTEUR, 'le sélecteur ne lit plus la valeur').toContain("dataset['pays']");
  });

  it('masque aussi les titres de pays, devenus inutiles après le choix', () => {
    expect(ACCUEIL).toContain('data-titre-pays');
    expect(SELECTEUR).toContain("'[data-titre-pays]'");
  });

  it('rend un bloc par pays du catalogue', () => {
    // Le bloc est rendu par un `map` sur `PAYS` : c'est ce lien qu'on vérifie,
    // plutôt qu'un compte écrit à la main qui vieillirait au premier pays
    // ajouté.
    expect(ACCUEIL).toContain('PAYS.map(');
    expect(PAYS.length).toBeGreaterThanOrEqual(2);
  });
});

describe('la mémorisation du choix', () => {
  it('écrit sous la clé déclarée dans la page de confidentialité', () => {
    /*
      `privacy-claims.test.ts` compte les points d'écriture, pas les CLÉS :
      renommer `luna-marea:pays` en autre chose y passerait inaperçu, et la
      page de confidentialité décrirait un stockage qui n'existe plus tout en
      taisant celui qui existe.
    */
    expect(CLIENT_STORAGE.map((entree) => entree.key)).toContain(CLE_PAYS);
  });

  it('protège chaque accès au stockage, qui peut lever en navigation privée', () => {
    // `localStorage` jette dans un onglet privé aux données bloquées. Une
    // exception non rattrapée ici casserait l'hydratation de la page
    // d'accueil entière, pour une préférence d'affichage.
    const acces = SELECTEUR.match(/localStorage\./g) ?? [];
    const filets = SELECTEUR.match(/\} catch \{/g) ?? [];
    expect(acces.length).toBeGreaterThan(0);
    expect(filets.length, 'un accès à localStorage sans try/catch').toBeGreaterThanOrEqual(2);
  });
});
