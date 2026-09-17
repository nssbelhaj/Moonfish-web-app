import { describe, expect, it } from 'vitest';

import { ipDeRequete, jetonDe } from '@/lib/api/porteur';

/**
 * Lecture de l'en-tête d'autorisation.
 *
 * Ce module ne vaut que par ce qu'il REFUSE : un jeton mal lu, c'est soit une
 * session qui ne s'ouvre jamais — l'application affiche un visiteur
 * perpétuellement déconnecté, sans message —, soit, bien pire, un en-tête mal
 * découpé qui laisserait passer autre chose qu'un jeton.
 */

function requete(autorisation: string | null): Request {
  return new Request('https://lunamarea.fr/api/v1/compte', {
    headers: autorisation === null ? {} : { authorization: autorisation },
  });
}

describe('le jeton porteur se lit sans surprise', () => {
  it('accepte la forme normale', () => {
    expect(jetonDe(requete('Bearer abc123'))).toBe('abc123');
  });

  it('ignore la casse du schéma, comme l’exige la RFC 7235', () => {
    /*
      Les bibliothèques HTTP des téléphones n'écrivent pas toutes « Bearer »
      avec la même majuscule. Comparer la chaîne telle quelle produirait un
      401 que personne ne saurait expliquer — et qu'on ne reproduirait pas
      depuis un navigateur.
    */
    expect(jetonDe(requete('bearer abc123'))).toBe('abc123');
    expect(jetonDe(requete('BEARER abc123'))).toBe('abc123');
    expect(jetonDe(requete('BeArEr abc123'))).toBe('abc123');
  });

  it('tolère les espaces autour du jeton', () => {
    expect(jetonDe(requete('Bearer    abc123   '))).toBe('abc123');
  });

  it('refuse un en-tête absent, vide ou sans jeton', () => {
    expect(jetonDe(requete(null))).toBeNull();
    expect(jetonDe(requete(''))).toBeNull();
    expect(jetonDe(requete('Bearer'))).toBeNull();
    expect(jetonDe(requete('Bearer '))).toBeNull();
    expect(jetonDe(requete('Bearer    '))).toBeNull();
  });

  it('refuse un autre schéma d’authentification', () => {
    // `Basic` porte un couple identifiant/mot de passe encodé : le prendre
    // pour un jeton le chercherait en base, où il ne serait pas, mais il
    // aurait voyagé dans nos journaux d'erreur au passage.
    expect(jetonDe(requete('Basic dXNlcjpwYXNz'))).toBeNull();
    expect(jetonDe(requete('Token abc123'))).toBeNull();
    expect(jetonDe(requete('abc123'))).toBeNull();
  });

  it('ne coupe pas un jeton contenant des caractères d’URL sûre', () => {
    // `creerSession` produit du base64url : tirets et tirets bas compris.
    const jeton = 'aB3-_x9ZqR7tU2vW4yX6zA8bC0dE1fG-hI_jK2lM3n';
    expect(jetonDe(requete(`Bearer ${jeton}`))).toBe(jeton);
  });
});

describe('l’adresse de l’appelant', () => {
  it('prend la première adresse de la chaîne transmise', () => {
    const r = new Request('https://lunamarea.fr/api/v1/compte', {
      headers: { 'x-forwarded-for': '203.0.113.7, 198.51.100.2' },
    });
    expect(ipDeRequete(r)).toBe('203.0.113.7');
  });

  it('retombe sur x-real-ip, puis sur « inconnu »', () => {
    expect(
      ipDeRequete(
        new Request('https://lunamarea.fr/api/v1/compte', {
          headers: { 'x-real-ip': '203.0.113.9' },
        }),
      ),
    ).toBe('203.0.113.9');

    expect(ipDeRequete(new Request('https://lunamarea.fr/api/v1/compte'))).toBe('inconnu');
  });

  it('ne rend jamais une chaîne vide, qui ferait un seau de compteur partagé', () => {
    // Toutes les requêtes sans adresse tomberaient dans le même compteur, et
    // la première à l'épuiser enfermerait dehors toutes les suivantes.
    const r = new Request('https://lunamarea.fr/api/v1/compte', {
      headers: { 'x-forwarded-for': '   ' },
    });
    expect(ipDeRequete(r)).toBe('inconnu');
  });
});
