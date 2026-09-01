import { describe, expect, it } from 'vitest';

import { ClosedContributionsRepository } from '../closed/contributions';

/**
 * Le dépôt « fermé » est ce que voit un déploiement sans base de données.
 *
 * Ces tests fixent la règle que le projet s'impose : sur les contributions, on
 * ne SIMULE rien. Une marée inventée illustre le fonctionnement du site et est
 * étiquetée comme telle ; un avis inventé serait un faux témoignage signé d'un
 * faux pêcheur, sur la seule page qui promet de rapporter ce que de vraies
 * personnes ont déclaré.
 */
describe('contributions, comptes fermés', () => {
  const repository = new ClosedContributionsRepository();

  it('se déclare indisponible plutôt que de faire semblant', () => {
    expect(repository.available).toBe(false);
  });

  it('ne fabrique aucun avis ni aucune prise', async () => {
    const spot = await repository.forSpot('pen-hat');
    expect(spot.reviews).toStrictEqual([]);
    expect(spot.catches).toStrictEqual([]);
    expect(spot.reviewCount).toBe(0);
  });

  it('rend `null` comme note moyenne, jamais zéro', async () => {
    // Zéro se lirait comme « très mauvais spot ». L'absence de note n'est pas
    // une mauvaise note.
    const spot = await repository.forSpot('pen-hat');
    expect(spot.averageRating).toBeNull();
  });

  it('refuse chaque écriture, avec un motif exploitable', async () => {
    const attempts = [
      repository.createProfile(),
      repository.renameProfile(),
      repository.saveReview(),
      repository.addCatch(),
      repository.deleteReview(),
      repository.deleteCatch(),
      repository.exportAccount(),
      repository.deleteAccount(),
    ];

    for (const result of await Promise.all(attempts)) {
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('not-available');
        expect(result.message.length).toBeGreaterThan(20);
      }
    }
  });

  it('n’annonce jamais une suppression de compte qu’il n’a pas faite', async () => {
    // Le pire mensonge possible sur cet écran : « votre compte a été supprimé »
    // alors que rien n'a été touché.
    const result = await repository.deleteAccount();
    expect(result.ok).toBe(false);
  });

  it('déclare une source honnête', () => {
    expect(repository.source.precision).toContain('Rien n’est simulé');
    expect(repository.source.kind).not.toBe('simulated');
  });
});
