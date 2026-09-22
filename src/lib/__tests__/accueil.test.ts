import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { CLIENT_STORAGE, CLIENT_STORAGE_WRITE_SITES } from '@/data/legal';
import { PAYS } from '@/data/spots';
import { CLE_PAYS, FACADE_PAR_DEFAUT } from '@/lib/facade';

/**
 * Le contrat de la page d'accueil, qu'aucun rendu unitaire ne peut voir.
 *
 * Le sélecteur de façade masque des blocs rendus par le SERVEUR, en les
 * retrouvant par `[data-pays]`. Les deux moitiés vivent dans des fichiers
 * différents, ne s'importent pas l'une l'autre, et rien dans le typage ne
 * les relie : renommer l'attribut d'un côté laisse l'autre compiler, passer
 * les tests, et afficher la France quoi qu'on choisisse.
 *
 * C'est exactement la classe de panne rencontrée trois fois dans ce projet —
 * spécificité CSS, champ de formulaire oublié, chemin de revalidation —
 * invisible aux tests unitaires, visible en deux secondes dans un
 * navigateur. Faute de pouvoir rendre la page ici, on attache au moins les
 * deux moitiés l'une à l'autre.
 */
const RACINE = path.resolve(__dirname, '../../..');
const lire = (relatif: string) => readFileSync(path.join(RACINE, relatif), 'utf8');

const ACCUEIL = lire('src/app/page.tsx');
const PAGE_PAYS = lire('src/app/spots/[country]/page.tsx');
const FACADE = lire('src/lib/facade.ts');
const SELECTEUR = lire('src/components/accueil/SelecteurFacade.tsx');
const RETENIR = lire('src/components/pays/RetenirPays.tsx');

describe('le masquage par façade', () => {
  it('emploie le même attribut des deux côtés', () => {
    expect(ACCUEIL, 'la page ne marque plus ses blocs').toContain('data-pays={pays.slug}');
    expect(FACADE, 'le module ne cherche plus les blocs').toContain("'[data-pays]'");
    expect(FACADE, 'le module ne lit plus la valeur').toContain("dataset['pays']");
  });

  it('rend la façade par défaut visible SANS script, et les autres masquées', () => {
    // Sans cet attribut posé au serveur, un visiteur sans JavaScript verrait
    // les trois pays empilés dans le héros.
    expect(ACCUEIL).toContain('hidden={pays.slug !== FACADE_PAR_DEFAUT}');
    expect(PAYS.some((pays) => pays.slug === FACADE_PAR_DEFAUT)).toBe(true);
  });

  it('rend un bloc par pays du catalogue', () => {
    expect(ACCUEIL).toContain('PAYS.map(');
    expect(PAYS.length).toBeGreaterThanOrEqual(2);
  });
});

describe('la mémorisation de la façade', () => {
  it('écrit sous la clé déclarée dans la page de confidentialité', () => {
    /*
      `privacy-claims.test.ts` compte les points d'écriture, pas les CLÉS :
      renommer `luna-marea:pays` y passerait inaperçu, et la page de
      confidentialité décrirait un stockage qui n'existe plus tout en
      taisant celui qui existe.
    */
    expect(CLIENT_STORAGE.map((entree) => entree.key)).toContain(CLE_PAYS);
  });

  it('n’écrit que depuis le module de façade, jamais depuis un composant', () => {
    // Deux composants la changent ; s'ils écrivaient chacun, la déclaration
    // de confidentialité devrait suivre chaque composant ajouté.
    expect(SELECTEUR).not.toMatch(/localStorage\./);
    expect(RETENIR).not.toMatch(/localStorage\./);
    expect(SELECTEUR).toContain('ecrireFacade(');
    expect(RETENIR).toContain('ecrireFacade(');
    expect(
      CLIENT_STORAGE_WRITE_SITES.find((site) => site.entry === CLE_PAYS)?.file,
    ).toBe('src/lib/facade.ts');
  });

  it('protège chaque accès au stockage, qui peut lever en navigation privée', () => {
    const acces = FACADE.match(/localStorage\./g) ?? [];
    const filets = FACADE.match(/\} catch \{/g) ?? [];
    expect(acces.length).toBeGreaterThan(0);
    expect(filets.length, 'un accès à localStorage sans try/catch').toBeGreaterThanOrEqual(2);
  });
});

describe('les pages pays', () => {
  it('sont pré-rendues pour chaque pays du catalogue', () => {
    expect(PAGE_PAYS).toContain('PAYS.map((pays) => ({ country: pays.slug }))');
  });

  it('offrent le bouton qui retient la façade — le seul autre point de changement', () => {
    expect(PAGE_PAYS).toContain('<RetenirPays');
  });
});
