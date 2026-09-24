import { preparerSchema } from '@/lib/db/__tests__/schema-de-test';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const DATABASE_URL = process.env.DATABASE_URL;
const describeDb = DATABASE_URL ? describe : describe.skip;

describeDb('le compteur de pages vues en base', () => {
  let db: typeof import('@/lib/db/mysql');
  let compter: typeof import('../compter');

  beforeAll(async () => {
    db = await import('@/lib/db/mysql');
    compter = await import('../compter');
    await preparerSchema(db);
  });

  afterAll(async () => {
    await db.closePool();
  });

  beforeEach(async () => {
    await db.execute('delete from visites');
  });

  it('incrémente une ligne par jour et par chemin, sans rien d’autre', async () => {
    const t = new Date('2026-09-24T10:00:00Z');
    await compter.enregistrerVisite('/', t);
    await compter.enregistrerVisite('/', t);
    await compter.enregistrerVisite('/spots', t);
    await compter.enregistrerVisite('/', new Date('2026-09-25T10:00:00Z'));

    const lignes = await db.query<{ jour: string; chemin: string; n: number }>(
      'select jour, chemin, n from visites order by jour, chemin',
    );
    expect(lignes.map((l) => [String(l.jour).slice(0, 10), l.chemin, Number(l.n)])).toStrictEqual([
      ['2026-09-24', '/', 2],
      ['2026-09-24', '/spots', 1],
      ['2026-09-25', '/', 1],
    ]);
    // Trois colonnes, pas une de plus : la table ne sait rien d'autre.
    const colonnes = await db.query<{ Field: string }>('show columns from visites');
    expect(colonnes.map((c) => c.Field).sort()).toStrictEqual(['chemin', 'jour', 'n']);
  });

  it('résume les sept derniers jours, les pages les plus vues en tête', async () => {
    const t = new Date('2026-09-24T10:00:00Z');
    for (let i = 0; i < 5; i += 1) await compter.enregistrerVisite('/', t);
    await compter.enregistrerVisite('/spots', t);
    // Hors fenêtre : il y a huit jours.
    await compter.enregistrerVisite('/vieux', new Date('2026-09-16T10:00:00Z'));

    const resume = await compter.resumeVisites(7, 8, t);
    expect(resume.total).toBe(6);
    expect(resume.pages).toStrictEqual([
      { chemin: '/', n: 5 },
      { chemin: '/spots', n: 1 },
    ]);
  });

  it('purge au-delà de treize mois, et garde le reste', async () => {
    const t = new Date('2026-09-24T10:00:00Z');
    await compter.enregistrerVisite('/', t);
    await compter.enregistrerVisite('/', new Date('2025-01-01T10:00:00Z'));
    expect(await compter.purgerVisites(t)).toBe(1);
    expect((await db.query('select * from visites')).length).toBe(1);
  });
});
