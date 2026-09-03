import { randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

/**
 * Favoris et sorties programmées, contre une vraie base.
 *
 * Même raison d'être que `contributions.integration.test.ts` : ces tables sont
 * DÉTENUES, et la garantie « on ne touche pas aux lignes d'autrui » repose sur
 * nos requêtes, pas sur le moteur. Elle ne se vérifie qu'en exécutant.
 *
 * Le test qui compte ici est « pendingAlerts ne rend une sortie qu'une fois » :
 * c'est lui qui empêche un cron relancé après incident de renvoyer dix
 * courriels pour la même sortie.
 */
const DATABASE_URL = process.env.DATABASE_URL;
const describeDb = DATABASE_URL ? describe : describe.skip;

describeDb('favoris et sorties dans MySQL', () => {
  let repository: import('../contributions').MysqlContributionsRepository;
  let db: typeof import('@/lib/db/mysql');

  let alice = '';
  let bob = '';

  beforeAll(async () => {
    db = await import('@/lib/db/mysql');
    repository = new (await import('../contributions')).MysqlContributionsRepository();

    const dir = path.join(process.cwd(), 'db/migrations');
    for (const file of (await readdir(dir)).filter((n) => n.endsWith('.sql')).sort()) {
      const sql = await readFile(path.join(dir, file), 'utf8');
      const statements = sql
        .split('\n')
        .filter((line) => !line.trim().startsWith('--'))
        .join('\n')
        .split(';')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      for (const statement of statements) await db.execute(statement);
    }
  });

  afterAll(async () => {
    await db.closePool();
  });

  beforeEach(async () => {
    for (const table of ['outings', 'favorites', 'catches', 'spot_reviews', 'profiles', 'sessions', 'accounts', 'users']) {
      await db.execute(`delete from ${table}`);
    }
    alice = randomUUID();
    bob = randomUUID();
    await db.execute('insert into users (id, email) values (?, ?)', [alice, 'alice@exemple.fr']);
    await db.execute('insert into users (id, email) values (?, ?)', [bob, 'bob@exemple.fr']);
  });

  const inTwoHours = () => new Date(Date.now() + 2 * 3_600_000).toISOString();

  describe('favoris', () => {
    it('ajoute, liste, et n’empile pas les doublons', async () => {
      expect((await repository.addFavorite(alice, 'pen-hat')).ok).toBe(true);
      expect((await repository.addFavorite(alice, 'pen-hat')).ok).toBe(true);
      expect((await repository.addFavorite(alice, 'la-torche')).ok).toBe(true);

      const list = await repository.listFavorites(alice);
      expect(list.map((f) => f.spotSlug).sort()).toStrictEqual(['la-torche', 'pen-hat']);
      expect(await repository.isFavorite(alice, 'pen-hat')).toBe(true);
      expect(await repository.isFavorite(bob, 'pen-hat')).toBe(false);
    });

    it('retire un favori sans toucher à ceux d’un autre', async () => {
      await repository.addFavorite(alice, 'pen-hat');
      await repository.addFavorite(bob, 'pen-hat');

      await repository.removeFavorite(alice, 'pen-hat');

      expect(await repository.isFavorite(alice, 'pen-hat')).toBe(false);
      expect(await repository.isFavorite(bob, 'pen-hat')).toBe(true);
    });

    it('refuse un slug qui n’en est pas un', async () => {
      const result = await repository.addFavorite(alice, "'; drop table users; --");
      expect(result.ok).toBe(false);
    });
  });

  describe('sorties programmées', () => {
    it('programme une sortie et la relit', async () => {
      const added = await repository.addOuting(alice, {
        spotSlug: 'pen-hat',
        plannedAt: inTwoHours(),
        note: 'marée de 6 h',
        alert: true,
        minScore: 6,
      });
      expect(added.ok).toBe(true);

      const list = await repository.listOutings(alice);
      expect(list).toHaveLength(1);
      expect(list[0]).toMatchObject({ spotSlug: 'pen-hat', note: 'marée de 6 h', alert: true, minScore: 6, notifiedAt: null });
    });

    it('REFUSE de supprimer la sortie d’un autre', async () => {
      const added = await repository.addOuting(alice, {
        spotSlug: 'pen-hat',
        plannedAt: inTwoHours(),
        note: null,
        alert: false,
        minScore: null,
      });
      expect(added.ok).toBe(true);
      if (!added.ok) return;

      const theft = await repository.deleteOuting(added.data.id, bob);
      expect(theft.ok).toBe(false);
      expect(await repository.listOutings(alice)).toHaveLength(1);

      const own = await repository.deleteOuting(added.data.id, alice);
      expect(own.ok).toBe(true);
      expect(await repository.listOutings(alice)).toHaveLength(0);
    });

    it('accepte une sortie sans seuil ni note', async () => {
      // Le schéma d'entrée est appliqué deux fois sur le trajet : ce cas est
      // celui qui avait cassé les prises sans mesure.
      const added = await repository.addOuting(alice, {
        spotSlug: 'pen-hat',
        plannedAt: inTwoHours(),
        note: null,
        alert: true,
        minScore: null,
      });
      expect(added.ok).toBe(true);
    });
  });

  describe('alertes', () => {
    it('ne rend que les sorties à venir, avec alerte, non encore notifiées, dans l’horizon', async () => {
      const now = new Date();
      const h = 3_600_000;

      const cases = [
        { label: 'dans 2 h, alerte', at: now.getTime() + 2 * h, alert: true, expected: true },
        { label: 'dans 2 h, sans alerte', at: now.getTime() + 2 * h, alert: false, expected: false },
        { label: 'dans 5 jours', at: now.getTime() + 120 * h, alert: true, expected: false },
        { label: 'passée', at: now.getTime() - 2 * h, alert: true, expected: false },
      ];

      const ids = new Map<string, string>();
      for (const c of cases) {
        const added = await repository.addOuting(alice, {
          spotSlug: 'pen-hat',
          plannedAt: new Date(c.at).toISOString(),
          note: c.label,
          alert: c.alert,
          minScore: null,
        });
        if (added.ok) ids.set(c.label, added.data.id);
      }

      const pending = await repository.pendingAlerts(now, 36 * h);
      const labels = pending.map((p) => p.outing.note);

      for (const c of cases) {
        expect(labels.includes(c.label), c.label).toBe(c.expected);
      }
      expect(pending[0]?.email).toBe('alice@exemple.fr');
    });

    it('ne rend une sortie qu’UNE fois après marquage', async () => {
      // ═══ LE test de ce fichier ═══
      // Un cron relancé après incident renverrait sinon le même courriel à
      // chaque passage.
      const added = await repository.addOuting(alice, {
        spotSlug: 'pen-hat',
        plannedAt: inTwoHours(),
        note: null,
        alert: true,
        minScore: null,
      });
      expect(added.ok).toBe(true);
      if (!added.ok) return;

      const now = new Date();
      expect(await repository.pendingAlerts(now, 36 * 3_600_000)).toHaveLength(1);

      await repository.markNotified(added.data.id, alice, now);
      expect(await repository.pendingAlerts(now, 36 * 3_600_000)).toHaveLength(0);

      const [outing] = await repository.listOutings(alice);
      expect(outing?.notifiedAt).not.toBeNull();
    });

    it('n’accepte pas qu’un autre marque une sortie comme notifiée', async () => {
      const added = await repository.addOuting(alice, {
        spotSlug: 'pen-hat',
        plannedAt: inTwoHours(),
        note: null,
        alert: true,
        minScore: null,
      });
      if (!added.ok) return;

      await repository.markNotified(added.data.id, bob, new Date());
      expect(await repository.pendingAlerts(new Date(), 36 * 3_600_000)).toHaveLength(1);
    });
  });

  describe('droits', () => {
    it('exporte favoris et sorties avec le reste', async () => {
      await repository.createProfile(alice, 'Alice');
      await repository.addFavorite(alice, 'pen-hat');
      await repository.addOuting(alice, { spotSlug: 'pen-hat', plannedAt: inTwoHours(), note: null, alert: true, minScore: null });

      const result = await repository.exportAccount(alice, 'alice@exemple.fr');
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.data.favorites).toHaveLength(1);
      expect(result.data.outings).toHaveLength(1);
    });

    it('l’effacement du compte emporte favoris et sorties', async () => {
      await repository.addFavorite(alice, 'pen-hat');
      await repository.addOuting(alice, { spotSlug: 'pen-hat', plannedAt: inTwoHours(), note: null, alert: true, minScore: null });

      expect((await repository.deleteAccount(alice)).ok).toBe(true);

      const [fav] = await db.query<{ n: number }>('select count(*) as n from favorites');
      const [out] = await db.query<{ n: number }>('select count(*) as n from outings');
      expect(Number(fav?.n)).toBe(0);
      expect(Number(out?.n)).toBe(0);
    });
  });
});
