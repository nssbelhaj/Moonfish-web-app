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

  it('exige un propriétaire pour supprimer, jusque dans les types', () => {
    // La signature est ce qui remplace la politique appliquée par PostgreSQL :
    // on ne PEUT pas écrire un appel de suppression sans dire au nom de qui on
    // agit, le compilateur refuse. C'est vérifié à la compilation, ici on
    // documente simplement l'intention.
    expect(repository.deleteReview.length).toBe(2);
    expect(repository.deleteCatch.length).toBe(2);
  });

  it('rend `null` comme note moyenne, jamais zéro', async () => {
    // Zéro se lirait comme « très mauvais spot ». L'absence de note n'est pas
    // une mauvaise note.
    const spot = await repository.forSpot('pen-hat');
    expect(spot.averageRating).toBeNull();
  });

  it('refuse chaque écriture, avec un motif exploitable', async () => {
    const ANY_USER = '00000000-0000-4000-8000-000000000000';
    const attempts = [
      repository.createProfile(ANY_USER, 'Pêcheur'),
      repository.renameProfile(ANY_USER, 'Pêcheur'),
      repository.saveReview({ spotSlug: 'pen-hat', rating: 4, comment: null }, { userId: ANY_USER, displayName: 'Pêcheur' }),
      repository.addCatch(
        {
          spotSlug: 'pen-hat',
          species: 'Bar',
          lengthCm: null,
          weightG: null,
          released: false,
          caughtAt: '2026-09-01T16:30:00.000Z',
          note: null,
          photoPath: null,
        },
        { userId: ANY_USER, displayName: 'Pêcheur' },
      ),
      repository.deleteReview('r1', ANY_USER),
      repository.deleteCatch('c1', ANY_USER),
      repository.exportAccount(ANY_USER, 'test@exemple.fr'),
      repository.deleteAccount(ANY_USER),
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
    const result = await repository.deleteAccount('00000000-0000-4000-8000-000000000000');
    expect(result.ok).toBe(false);
  });

  it('déclare une source honnête', () => {
    expect(repository.source.precision).toContain('Rien n’est simulé');
    expect(repository.source.kind).not.toBe('simulated');
  });
});
