import { preparerSchema } from '@/lib/db/__tests__/schema-de-test';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type { CatchInput } from '@/data/schemas';

/**
 * Une prise privée ne doit PAS quitter la base.
 *
 * Le contrôle est dans la requête, pas dans un filtre appliqué au rendu :
 * c'est ce que ces tests vérifient, en lisant ce que `forSpot` rend
 * réellement. Un filtre côté JavaScript passerait ces mêmes assertions tout
 * en laissant la donnée voyager jusqu'au composant — donc jusqu'au prochain
 * export, à la prochaine API, au prochain rendu distrait.
 */
const DATABASE_URL = process.env.DATABASE_URL;
const describeDb = DATABASE_URL ? describe : describe.skip;

describeDb('la visibilité des prises', () => {
  let db: typeof import('@/lib/db/mysql');
  let repository: import('../contributions').MysqlContributionsRepository;

  const ALICE = { userId: '00000000-0000-4000-8000-0000000000aa', displayName: 'Alice' };
  const BOB = { userId: '00000000-0000-4000-8000-0000000000bb', displayName: 'Bob' };

  const PRISE = {
    spotSlug: 'pen-hat',
    species: 'Bar',
    lengthCm: 52,
    weightG: 1800,
    released: false,
    caughtAt: '2026-09-01T18:30:00.000Z',
    note: null,
    photoPath: null,
    visibility: 'privee',
  } as const satisfies CatchInput;

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
      await db.execute('insert into profiles (user_id, display_name, consent_version) values (?, ?, ?)', [
        userId,
        displayName,
        '2026-09-01',
      ]);
    }
  });

  it('garde une prise privée hors de la page du spot', async () => {
    const saved = await repository.addCatch(PRISE, ALICE);
    expect(saved.ok).toBe(true);

    const publiques = await repository.forSpot('pen-hat');
    expect(publiques.catches).toStrictEqual([]);

    // …mais elle reste dans le carnet de son auteur, qui est tout l'intérêt.
    const sien = await repository.listForUser(ALICE.userId);
    expect(sien.catches).toHaveLength(1);
  });

  it('montre une prise publiée', async () => {
    await repository.addCatch({ ...PRISE, visibility: 'publique' }, ALICE);
    const publiques = await repository.forSpot('pen-hat');
    expect(publiques.catches).toHaveLength(1);
    expect(publiques.catches[0]?.authorName).toBe('Alice');
  });

  it('publie et reprend, à la demande de l’auteur', async () => {
    const saved = await repository.addCatch(PRISE, ALICE);
    if (!saved.ok) throw new Error(saved.message);

    expect((await repository.setCatchVisibility(saved.data.id, ALICE.userId, 'publique')).ok).toBe(true);
    expect((await repository.forSpot('pen-hat')).catches).toHaveLength(1);

    expect((await repository.setCatchVisibility(saved.data.id, ALICE.userId, 'privee')).ok).toBe(true);
    expect((await repository.forSpot('pen-hat')).catches).toStrictEqual([]);
  });

  it('refuse à quelqu’un d’autre de publier votre prise', async () => {
    /*
      MySQL ne connaît pas la sécurité au niveau des lignes : la SEULE chose
      qui empêche Bob de publier la prise d'Alice est la clause `user_id = ?`
      de la requête. Si elle disparaissait un jour, ce test tomberait — et
      rien d'autre ne le ferait.
    */
    const saved = await repository.addCatch(PRISE, ALICE);
    if (!saved.ok) throw new Error(saved.message);

    const vol = await repository.setCatchVisibility(saved.data.id, BOB.userId, 'publique');
    expect(vol.ok).toBe(false);
    expect((await repository.forSpot('pen-hat')).catches).toStrictEqual([]);
  });

  it('est PRIVÉE par défaut, jusque dans le schéma', async () => {
    // Le défaut vit à trois endroits — Zod, la colonne, le formulaire — et
    // les trois doivent dire la même chose. Ici : ce que la base retient
    // quand personne n'a choisi.
    const { catchInputSchema } = await import('@/data/schemas');
    const analyse = catchInputSchema.parse({
      spotSlug: 'pen-hat',
      species: 'Bar',
      caughtAt: '2026-09-01T18:30:00.000Z',
    });
    expect(analyse.visibility).toBe('privee');

    const saved = await repository.addCatch(analyse, ALICE);
    if (!saved.ok) throw new Error(saved.message);
    expect(saved.data.visibility).toBe('privee');
  });
});
