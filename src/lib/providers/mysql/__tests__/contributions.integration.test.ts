import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

/**
 * Tests d'INTÉGRATION, contre une vraie base MySQL / MariaDB.
 *
 * Ils existent parce que la garantie perdue au passage de PostgreSQL à MySQL —
 * la sécurité au niveau des lignes — n'est plus appliquée par le moteur. Elle
 * repose désormais sur ce que fait ce code, et ce que fait ce code ne se
 * vérifie qu'en l'exécutant.
 *
 * Le test central est « supprimer l'avis d'un autre ». Sur PostgreSQL, la base
 * refusait ; ici, c'est notre requête qui doit refuser, et c'est exactement ce
 * qu'un oubli ferait sauter en silence.
 *
 * Lancement :
 *   DATABASE_URL=mysql://user:pass@127.0.0.1:3306/moonfish_test npm run test
 *
 * Sans `DATABASE_URL`, la suite est ignorée plutôt que rouge : un clone du
 * dépôt doit pouvoir lancer les tests sans installer de serveur.
 */
const DATABASE_URL = process.env.DATABASE_URL;
const describeDb = DATABASE_URL ? describe : describe.skip;

describeDb('contributions dans MySQL', () => {
  let uploads: string;
  let repository: import('../contributions').MysqlContributionsRepository;
  let waitlist: import('../waitlist').MysqlWaitlistRepository;
  let db: typeof import('@/lib/db/mysql');
  let storage: typeof import('@/lib/photo/storage');

  /** Deux pêcheurs distincts, recréés à chaque test. */
  const ALICE = { userId: '', displayName: 'Alice' };
  const BOB = { userId: '', displayName: 'Bob' };

  beforeAll(async () => {
    uploads = await mkdtemp(path.join(os.tmpdir(), 'moonfish-photos-'));
    process.env.UPLOADS_DIR = uploads;

    db = await import('@/lib/db/mysql');
    storage = await import('@/lib/photo/storage');
    repository = new (await import('../contributions')).MysqlContributionsRepository();
    waitlist = new (await import('../waitlist')).MysqlWaitlistRepository();

    const migration = await readFile(
      path.join(process.cwd(), 'db/migrations/0001_comptes_et_contributions.sql'),
      'utf8',
    );

    // Le pilote n'exécute qu'une instruction par appel : on découpe. Les
    // commentaires sont retirés d'abord, sinon un « ; » dans une phrase
    // française couperait au mauvais endroit.
    const statements = migration
      .split('\n')
      .filter((line) => !line.trim().startsWith('--'))
      .join('\n')
      .split(';')
      .map((statement) => statement.trim())
      .filter((statement) => statement.length > 0);

    for (const statement of statements) await db.execute(statement);
  });

  afterAll(async () => {
    await db.closePool();
  });

  beforeEach(async () => {
    // Ordre imposé par les clés étrangères : les enfants d'abord.
    for (const table of ['catches', 'spot_reviews', 'profiles', 'sessions', 'accounts', 'users', 'waitlist']) {
      await db.execute(`delete from ${table}`);
    }

    ALICE.userId = randomUUID();
    BOB.userId = randomUUID();

    for (const person of [ALICE, BOB]) {
      await db.execute('insert into users (id, email) values (?, ?)', [
        person.userId,
        `${person.displayName.toLowerCase()}@exemple.fr`,
      ]);
      await repository.createProfile(person.userId, person.displayName);
    }
  });

  describe('avis', () => {
    it('enregistre un avis et le rend sur le spot', async () => {
      const saved = await repository.saveReview(
        { spotSlug: 'pen-hat', rating: 4, comment: 'Belle pointe, accès rude.' },
        ALICE,
      );
      expect(saved.ok).toBe(true);

      const spot = await repository.forSpot('pen-hat');
      expect(spot.reviews).toHaveLength(1);
      expect(spot.reviews[0]?.authorName).toBe('Alice');
      expect(spot.reviews[0]?.rating).toBe(4);
      expect(spot.averageRating).toBe(4);
    });

    it('remplace l’avis d’une même personne au lieu de l’empiler', async () => {
      // Empiler gonflerait la moyenne et transformerait une note en tribune.
      await repository.saveReview({ spotSlug: 'pen-hat', rating: 2, comment: null }, ALICE);
      await repository.saveReview({ spotSlug: 'pen-hat', rating: 5, comment: 'Mieux vu' }, ALICE);

      const spot = await repository.forSpot('pen-hat');
      expect(spot.reviews).toHaveLength(1);
      expect(spot.reviews[0]?.rating).toBe(5);
      expect(spot.averageRating).toBe(5);
    });

    it('moyenne plusieurs personnes', async () => {
      await repository.saveReview({ spotSlug: 'pen-hat', rating: 2, comment: null }, ALICE);
      await repository.saveReview({ spotSlug: 'pen-hat', rating: 5, comment: null }, BOB);

      const spot = await repository.forSpot('pen-hat');
      expect(spot.reviewCount).toBe(2);
      expect(spot.averageRating).toBe(3.5);
    });

    it('REFUSE de supprimer l’avis d’un autre', async () => {
      // ═══ LE test de ce fichier ═══
      // C'est la garantie que PostgreSQL appliquait lui-même et qui repose
      // désormais sur notre requête. Un `where user_id = ?` oublié rendrait ce
      // test vert nulle part ailleurs : ici, il tombe.
      const saved = await repository.saveReview(
        { spotSlug: 'pen-hat', rating: 4, comment: 'à moi' },
        ALICE,
      );
      expect(saved.ok).toBe(true);
      if (!saved.ok) return;

      const attempt = await repository.deleteReview(saved.data.id, BOB.userId);
      expect(attempt.ok).toBe(false);

      const spot = await repository.forSpot('pen-hat');
      expect(spot.reviews).toHaveLength(1);
      expect(spot.reviews[0]?.comment).toBe('à moi');
    });

    it('laisse chacun supprimer le sien', async () => {
      const saved = await repository.saveReview({ spotSlug: 'pen-hat', rating: 4, comment: null }, ALICE);
      if (!saved.ok) throw new Error('avis non enregistré');

      expect((await repository.deleteReview(saved.data.id, ALICE.userId)).ok).toBe(true);
      expect((await repository.forSpot('pen-hat')).reviews).toHaveLength(0);
    });
  });

  describe('prises', () => {
    const PRISE = {
      spotSlug: 'pen-hat',
      species: 'Bar',
      lengthCm: 47,
      weightG: 1250,
      released: true,
      caughtAt: '2026-09-01T16:30:00.000Z',
      note: 'Montée de marée',
      photoPath: null,
    };

    it('conserve l’instant de la prise SANS dérive de fuseau', async () => {
      // Le piège classique : MySQL rend un « datetime » sans fuseau. Une
      // conversion négligée décalerait la prise de deux heures en été, donc de
      // créneau de marée — l'erreur exacte que ce site existe pour éviter.
      const saved = await repository.addCatch(PRISE, ALICE);
      expect(saved.ok).toBe(true);
      if (!saved.ok) return;

      expect(saved.data.caughtAt).toBe('2026-09-01T16:30:00.000Z');

      const spot = await repository.forSpot('pen-hat');
      expect(spot.catches[0]?.caughtAt).toBe('2026-09-01T16:30:00.000Z');
    });

    it('rend un vrai booléen pour « remis à l’eau »', async () => {
      // MySQL stocke 0 ou 1 : sans conversion, `released` vaudrait 0, qui est
      // falsy mais n'est pas `false` — et le schéma Zod rejetterait la ligne.
      const saved = await repository.addCatch({ ...PRISE, released: true }, ALICE);
      if (!saved.ok) throw new Error('prise non enregistrée');
      expect(saved.data.released).toBe(true);

      const autre = await repository.addCatch({ ...PRISE, released: false }, BOB);
      if (!autre.ok) throw new Error('prise non enregistrée');
      expect(autre.data.released).toBe(false);
    });

    it('accepte une prise sans mesure ni note', async () => {
      const saved = await repository.addCatch(
        { ...PRISE, lengthCm: null, weightG: null, note: null },
        ALICE,
      );
      if (!saved.ok) throw new Error('prise non enregistrée');

      expect(saved.data.lengthCm).toBeNull();
      expect(saved.data.weightG).toBeNull();
      expect(saved.data.note).toBeNull();
    });

    it('REFUSE de supprimer la prise d’un autre', async () => {
      const saved = await repository.addCatch(PRISE, ALICE);
      if (!saved.ok) throw new Error('prise non enregistrée');

      const attempt = await repository.deleteCatch(saved.data.id, BOB.userId);
      expect(attempt.ok).toBe(false);
      expect((await repository.forSpot('pen-hat')).catches).toHaveLength(1);
    });

    it('efface la photo avec la prise', async () => {
      const saved = await storage.savePhoto(
        ALICE.userId,
        new Uint8Array([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x01]),
        'image/jpeg',
      );
      if (!saved.ok) throw new Error(saved.message);

      const prise = await repository.addCatch({ ...PRISE, photoPath: saved.path }, ALICE);
      if (!prise.ok) throw new Error('prise non enregistrée');

      expect(existsSync(path.join(uploads, saved.path))).toBe(true);

      await repository.deleteCatch(prise.data.id, ALICE.userId);

      // Un fichier orphelin est une donnée personnelle qui survit à son
      // effacement : c'est précisément ce que le droit à l'effacement interdit.
      expect(existsSync(path.join(uploads, saved.path))).toBe(false);
    });

    it('ne touche PAS à la photo quand la suppression est refusée', async () => {
      const saved = await storage.savePhoto(
        ALICE.userId,
        new Uint8Array([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x01]),
        'image/jpeg',
      );
      if (!saved.ok) throw new Error(saved.message);

      const prise = await repository.addCatch({ ...PRISE, photoPath: saved.path }, ALICE);
      if (!prise.ok) throw new Error('prise non enregistrée');

      await repository.deleteCatch(prise.data.id, BOB.userId);
      expect(existsSync(path.join(uploads, saved.path))).toBe(true);
    });
  });

  describe('effacement du compte', () => {
    it('emporte le profil, les avis, les prises et les photos', async () => {
      const photo = await storage.savePhoto(
        ALICE.userId,
        new Uint8Array([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x01]),
        'image/jpeg',
      );
      if (!photo.ok) throw new Error(photo.message);

      await repository.saveReview({ spotSlug: 'pen-hat', rating: 4, comment: null }, ALICE);
      await repository.addCatch(
        {
          spotSlug: 'pen-hat',
          species: 'Bar',
          lengthCm: null,
          weightG: null,
          released: false,
          caughtAt: '2026-09-01T16:30:00.000Z',
          note: null,
          photoPath: photo.path,
        },
        ALICE,
      );
      await repository.saveReview({ spotSlug: 'pen-hat', rating: 5, comment: null }, BOB);

      expect((await repository.deleteAccount(ALICE.userId)).ok).toBe(true);

      const spot = await repository.forSpot('pen-hat');
      expect(spot.reviews).toHaveLength(1);
      expect(spot.reviews[0]?.authorName).toBe('Bob');
      expect(spot.catches).toHaveLength(0);
      expect(await repository.getProfile(ALICE.userId)).toBeNull();
      expect(existsSync(path.join(uploads, photo.path))).toBe(false);
    });

    it('n’emporte rien qui appartienne à quelqu’un d’autre', async () => {
      await repository.saveReview({ spotSlug: 'pen-hat', rating: 5, comment: null }, BOB);
      await repository.deleteAccount(ALICE.userId);

      expect(await repository.getProfile(BOB.userId)).not.toBeNull();
      expect((await repository.forSpot('pen-hat')).reviews).toHaveLength(1);
    });
  });

  describe('export des données', () => {
    it('rend tout ce que nous détenons, et rien des autres', async () => {
      await repository.saveReview({ spotSlug: 'pen-hat', rating: 4, comment: 'à moi' }, ALICE);
      await repository.saveReview({ spotSlug: 'le-dossen', rating: 2, comment: 'à Bob' }, BOB);

      const exported = await repository.exportAccount(ALICE.userId, 'alice@exemple.fr');
      expect(exported.ok).toBe(true);
      if (!exported.ok) return;

      expect(exported.data.profile?.displayName).toBe('Alice');
      expect(exported.data.reviews).toHaveLength(1);
      expect(exported.data.reviews[0]?.comment).toBe('à moi');
      expect(JSON.stringify(exported.data)).not.toContain('à Bob');
    });
  });

  describe('liste d’attente', () => {
    it('accepte une adresse, puis signale qu’elle est déjà inscrite', async () => {
      const first = await waitlist.add({ email: 'Pecheur@Exemple.FR' }, { ip: '203.0.113.1' });
      expect(first).toStrictEqual({ ok: true, alreadyRegistered: false });

      const second = await waitlist.add({ email: 'pecheur@exemple.fr' }, { ip: '203.0.113.2' });
      expect(second).toStrictEqual({ ok: true, alreadyRegistered: true });
    });

    it('ne sait pas compter, et le dit', async () => {
      // Aucun chemin de lecture n'existe : rendre 0 ferait passer une absence
      // de droit pour une liste vide.
      expect(await waitlist.count()).toBeNull();
    });
  });

  describe('protection contre l’injection', () => {
    it('traite une valeur hostile comme du texte, pas comme du SQL', async () => {
      const hostile = "Bar'); drop table catches; --";

      const saved = await repository.addCatch(
        {
          spotSlug: 'pen-hat',
          species: hostile.slice(0, 60),
          lengthCm: null,
          weightG: null,
          released: false,
          caughtAt: '2026-09-01T16:30:00.000Z',
          note: null,
          photoPath: null,
        },
        ALICE,
      );

      expect(saved.ok).toBe(true);

      // La table existe toujours, et la valeur a été stockée telle quelle.
      const spot = await repository.forSpot('pen-hat');
      expect(spot.catches).toHaveLength(1);
      expect(spot.catches[0]?.species).toBe(hostile.slice(0, 60));
    });
  });
});
