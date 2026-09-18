import { preparerSchema } from '@/lib/db/__tests__/schema-de-test';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type { CatchInput } from '@/data/schemas';

/**
 * La page d'accueil montre les dernières contributions PUBLIQUES.
 *
 * C'est la première fois que des contributions sortent d'une page de spot
 * pour atterrir sur la page la plus vue du site. Une prise privée qui
 * fuiterait ici serait vue par tout le monde, immédiatement — et le filtre
 * `visibility = 'publique'` d'une requête est exactement le genre de clause
 * qu'on oublie en écrivant une seconde requête sur la même table.
 */
const DATABASE_URL = process.env.DATABASE_URL;
const describeDb = DATABASE_URL ? describe : describe.skip;

describeDb('les dernières contributions publiques', () => {
  let db: typeof import('@/lib/db/mysql');
  let repository: import('../contributions').MysqlContributionsRepository;

  const ALICE = { userId: '00000000-0000-4000-8000-0000000000aa', displayName: 'Alice' };
  const BOB = { userId: '00000000-0000-4000-8000-0000000000bb', displayName: 'Bob' };

  function prise(complement: Partial<CatchInput>): CatchInput {
    return {
      spotSlug: 'pen-hat',
      species: 'Bar',
      lengthCm: 52,
      weightG: 1800,
      released: false,
      caughtAt: '2026-09-01T18:30:00.000Z',
      note: null,
      photoPath: null,
      visibility: 'privee',
      ...complement,
    } as CatchInput;
  }

  beforeAll(async () => {
    db = await import('@/lib/db/mysql');
    const mod = await import('../contributions');
    repository = new mod.MysqlContributionsRepository();
    await preparerSchema(db);
  });

  afterAll(async () => {
    await db.closePool();
  });

  beforeEach(async () => {
    for (const table of ['catches', 'spot_reviews', 'profiles', 'users']) {
      await db.execute(`delete from ${table}`);
    }
    for (const { userId, displayName } of [ALICE, BOB]) {
      await db.execute('insert into users (id, name, email) values (?, ?, ?)', [
        userId,
        displayName,
        `${displayName.toLowerCase()}@exemple.fr`,
      ]);
      await db.execute(
        'insert into profiles (user_id, display_name, consent_version) values (?, ?, ?)',
        [userId, displayName, '2026-09-01'],
      );
    }
  });

  it('ne laisse sortir AUCUNE prise privée', async () => {
    await repository.addCatch(prise({ species: 'Maquereau' }), ALICE);
    await repository.addCatch(prise({ species: 'Dorade', spotSlug: 'le-dossen' }), BOB);

    const recentes = await repository.recentPublic(10);
    expect(recentes.catches).toStrictEqual([]);
  });

  it('rend les prises publiées, tous spots confondus', async () => {
    await repository.addCatch(
      prise({ species: 'Bar', visibility: 'publique', caughtAt: '2026-09-03T18:00:00.000Z' }),
      ALICE,
    );
    await repository.addCatch(
      prise({
        species: 'Lieu jaune',
        spotSlug: 'le-dossen',
        visibility: 'publique',
        caughtAt: '2026-09-05T07:00:00.000Z',
      }),
      BOB,
    );
    await repository.addCatch(prise({ species: 'Secrète' }), ALICE);

    const recentes = await repository.recentPublic(10);
    expect(recentes.catches.map((c) => c.species)).toStrictEqual(['Lieu jaune', 'Bar']);
    expect(new Set(recentes.catches.map((c) => c.spotSlug))).toStrictEqual(
      new Set(['pen-hat', 'le-dossen']),
    );
  });

  it('trie sur la date de PRISE, pas sur celle de saisie', async () => {
    // Saisie dans l'ordre inverse : la plus ancienne enregistrée en dernier.
    await repository.addCatch(
      prise({ species: 'Récente', visibility: 'publique', caughtAt: '2026-09-10T06:00:00.000Z' }),
      ALICE,
    );
    await repository.addCatch(
      prise({ species: 'Ancienne', visibility: 'publique', caughtAt: '2026-08-01T06:00:00.000Z' }),
      ALICE,
    );

    const recentes = await repository.recentPublic(10);
    expect(recentes.catches.map((c) => c.species)).toStrictEqual(['Récente', 'Ancienne']);
  });

  it('borne CHAQUE liste, pas leur somme', async () => {
    for (let i = 0; i < 5; i += 1) {
      await repository.addCatch(
        prise({
          species: `Espèce ${i}`,
          visibility: 'publique',
          caughtAt: `2026-09-0${i + 1}T06:00:00.000Z`,
        }),
        ALICE,
      );
    }
    await repository.saveReview({ spotSlug: 'pen-hat', rating: 5, comment: null }, ALICE);
    await repository.saveReview({ spotSlug: 'le-dossen', rating: 4, comment: null }, BOB);

    const recentes = await repository.recentPublic(2);
    expect(recentes.catches).toHaveLength(2);
    expect(recentes.reviews).toHaveLength(2);
  });

  it('refuse une borne absurde plutôt que de la passer à la base', async () => {
    for (let i = 0; i < 3; i += 1) {
      await repository.addCatch(
        prise({
          species: `Espèce ${i}`,
          visibility: 'publique',
          caughtAt: `2026-09-0${i + 1}T06:00:00.000Z`,
        }),
        ALICE,
      );
    }

    // Zéro et négatif remontent à 1 ; l'énorme est plafonné. Dans tous les
    // cas la requête part avec un entier, jamais avec ce qu'on lui a donné.
    expect((await repository.recentPublic(0)).catches).toHaveLength(1);
    expect((await repository.recentPublic(-5)).catches).toHaveLength(1);
    expect((await repository.recentPublic(1e9)).catches).toHaveLength(3);
  });

  it('rend les avis du plus récent au plus ancien', async () => {
    await repository.saveReview({ spotSlug: 'pen-hat', rating: 3, comment: 'Premier' }, ALICE);
    await new Promise((resolve) => setTimeout(resolve, 1100));
    await repository.saveReview({ spotSlug: 'le-dossen', rating: 5, comment: 'Second' }, BOB);

    const recentes = await repository.recentPublic(10);
    expect(recentes.reviews.map((r) => r.comment)).toStrictEqual(['Second', 'Premier']);
  });
});
