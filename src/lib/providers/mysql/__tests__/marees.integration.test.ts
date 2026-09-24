import { preparerSchema } from '@/lib/db/__tests__/schema-de-test';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

/**
 * Le magasin MySQL des tables de marée : ce qui survit aux builds et aux
 * redéploiements, et qui fait tenir le catalogue dans le palier gratuit.
 */
const DATABASE_URL = process.env.DATABASE_URL;
const describeDb = DATABASE_URL ? describe : describe.skip;

describeDb('les tables de marée en base', () => {
  let db: typeof import('@/lib/db/mysql');
  let store: import('../marees').MysqlTideTableStore;

  const TABLE = {
    pointSlug: 'pen-hat',
    coversFrom: '2026-09-22T00:00:00.000Z',
    coversTo: '2026-10-05T18:30:00.000Z',
    extremes: [
      { time: '2026-09-22T03:10:00.000Z', heightM: 6.4, type: 'high' as const },
      { time: '2026-09-22T09:25:00.000Z', heightM: 1.2, type: 'low' as const },
    ],
    sourceName: 'Stormglass — modèle de marée',
    fetchedAt: '2026-09-24T06:00:00.000Z',
  };

  beforeAll(async () => {
    db = await import('@/lib/db/mysql');
    const mod = await import('../marees');
    store = new mod.MysqlTideTableStore();
    await preparerSchema(db);
  });

  afterAll(async () => {
    await db.closePool();
  });

  beforeEach(async () => {
    await db.execute('delete from tide_tables');
  });

  it('rend null pour un point inconnu', async () => {
    expect(await store.lire('nulle-part')).toBeNull();
  });

  it('écrit puis relit une table à l’identique, dates en UTC', async () => {
    await store.ecrire(TABLE);
    expect(await store.lire('pen-hat')).toStrictEqual(TABLE);
  });

  it('remplace la table d’un point au lieu d’en ajouter une seconde', async () => {
    await store.ecrire(TABLE);
    await store.ecrire({ ...TABLE, coversTo: '2026-10-09T00:00:00.000Z', fetchedAt: '2026-09-28T06:00:00.000Z' });
    const toutes = await store.toutes();
    expect(toutes).toHaveLength(1);
    expect(toutes[0]!.coversTo).toBe('2026-10-09T00:00:00.000Z');
  });

  it('liste toutes les tables par couverture croissante', async () => {
    await store.ecrire({ ...TABLE, pointSlug: 'b', coversTo: '2026-10-09T00:00:00.000Z' });
    await store.ecrire({ ...TABLE, pointSlug: 'a', coversTo: '2026-10-02T00:00:00.000Z' });
    expect((await store.toutes()).map((t) => t.pointSlug)).toStrictEqual(['a', 'b']);
  });

  it('sérialise deux verrous sur le même point, et laisse deux points passer en parallèle', async () => {
    const ordre: string[] = [];
    const lent = (nom: string, ms: number) => async () => {
      ordre.push(`${nom}:debut`);
      await new Promise((r) => setTimeout(r, ms));
      ordre.push(`${nom}:fin`);
      return nom;
    };

    // Même point : le second attend la fin du premier.
    await Promise.all([store.verrou('brest', lent('a', 150)), store.verrou('brest', lent('b', 10))]);
    expect(ordre).toStrictEqual(['a:debut', 'a:fin', 'b:debut', 'b:fin']);

    // Points différents : les deux s'entrelacent.
    ordre.length = 0;
    await Promise.all([store.verrou('x', lent('x', 150)), store.verrou('y', lent('y', 10))]);
    expect(ordre.indexOf('y:fin')).toBeLessThan(ordre.indexOf('x:fin'));
  });

  it('traite une ligne au JSON corrompu comme ABSENTE, pour qu’elle soit redemandée', async () => {
    await db.execute(
      `insert into tide_tables (point_slug, covers_from, covers_to, extremes, source_name, fetched_at)
         values ('casse', '2026-09-22 00:00:00', '2026-10-05 00:00:00', '{pas du json', 'x', '2026-09-24 00:00:00')`,
    );
    expect(await store.lire('casse')).toBeNull();
    expect(await store.toutes()).toStrictEqual([]);
  });
});
