import { preparerSchema } from '@/lib/db/__tests__/schema-de-test';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

/**
 * Le limiteur de débit, contre une vraie base.
 *
 * Ce qui ne peut se vérifier qu'en exécutant : l'ordre insertion-puis-comptage,
 * le retrait de la tentative refusée, et la lecture de l'horodatage le plus
 * ancien — que la réserve de connexions rend en CHAÎNE sans fuseau, pas en
 * `Date`. Un test hermétique aurait validé une conversion qui n'a pas lieu.
 */
const DATABASE_URL = process.env.DATABASE_URL;
const describeDb = DATABASE_URL ? describe : describe.skip;

describeDb('le limiteur de débit dans MySQL', () => {
  let db: typeof import('@/lib/db/mysql');
  let limiteur: typeof import('../rate-limit');

  const FENETRE = 15 * 60_000;
  const T0 = Date.UTC(2026, 8, 9, 10, 0, 0);

  /** Nombre de lignes réellement stockées, tous horodatages confondus. */
  async function lignes(bucket = 'essai'): Promise<number> {
    const rows = await db.query<{ n: number }>(
      'select count(*) as n from rate_limits where bucket = ?',
      [bucket],
    );
    return Number(rows[0]?.n ?? 0);
  }

  beforeAll(async () => {
    db = await import('@/lib/db/mysql');
    limiteur = await import('../rate-limit');
    await preparerSchema(db);
  });

  afterAll(async () => {
    await db.closePool();
  });

  beforeEach(async () => {
    await db.execute('delete from rate_limits');
  });

  it('laisse passer jusqu’à la limite, puis refuse', async () => {
    for (let i = 1; i <= 3; i += 1) {
      const decision = await limiteur.checkMysqlLimit('essai', 'alice', 3, FENETRE, T0 + i);
      expect(decision.allowed, `tentative ${i}`).toBe(true);
      expect(decision.remaining).toBe(3 - i);
    }

    const refus = await limiteur.checkMysqlLimit('essai', 'alice', 3, FENETRE, T0 + 4);
    expect(refus.allowed).toBe(false);
    expect(refus.remaining).toBe(0);
  });

  it('la tentative refusée n’est pas conservée : marteler ne repousse pas le déblocage', async () => {
    for (let i = 1; i <= 3; i += 1) {
      await limiteur.checkMysqlLimit('essai', 'alice', 3, FENETRE, T0 + i);
    }
    expect(await lignes()).toBe(3);

    // Vingt refus d'affilée.
    for (let i = 0; i < 20; i += 1) {
      await limiteur.checkMysqlLimit('essai', 'alice', 3, FENETRE, T0 + 1_000 + i);
    }

    expect(await lignes()).toBe(3);
  });

  it('l’heure de déblocage suit la plus ANCIENNE tentative, pas la dernière', async () => {
    await limiteur.checkMysqlLimit('essai', 'alice', 2, FENETRE, T0);
    await limiteur.checkMysqlLimit('essai', 'alice', 2, FENETRE, T0 + 60_000);

    const refus = await limiteur.checkMysqlLimit('essai', 'alice', 2, FENETRE, T0 + 120_000);

    expect(refus.allowed).toBe(false);
    // La première tentative sort de la fenêtre à T0 + FENETRE ; c'est à ce
    // moment-là qu'une place se libère, pas une fenêtre après la dernière.
    expect(refus.resetAt).toBe(T0 + FENETRE);
  });

  it('rouvre quand les tentatives sortent de la fenêtre', async () => {
    for (let i = 1; i <= 3; i += 1) {
      await limiteur.checkMysqlLimit('essai', 'alice', 3, FENETRE, T0 + i);
    }
    expect((await limiteur.checkMysqlLimit('essai', 'alice', 3, FENETRE, T0 + 4)).allowed).toBe(false);

    const apres = await limiteur.checkMysqlLimit('essai', 'alice', 3, FENETRE, T0 + FENETRE + 1_000);
    expect(apres.allowed).toBe(true);
  });

  it('compte séparément deux sujets, et deux budgets', async () => {
    for (let i = 1; i <= 3; i += 1) {
      await limiteur.checkMysqlLimit('essai', 'alice', 3, FENETRE, T0 + i);
    }

    expect((await limiteur.checkMysqlLimit('essai', 'bob', 3, FENETRE, T0 + 5)).allowed).toBe(true);
    expect((await limiteur.checkMysqlLimit('autre', 'alice', 3, FENETRE, T0 + 5)).allowed).toBe(true);
  });

  it('une limite à deux chiffres se déclenche bien à dix, pas à trois', async () => {
    /*
      Le pilote rend aujourd'hui `count(*)` en nombre, et la conversion
      explicite du code est une précaution, pas un correctif. Ce test ne la
      met donc PAS à l'épreuve — il vérifie l'autre moitié : qu'une limite à
      deux chiffres s'applique telle quelle. Si un réglage du pilote changeait
      un jour ce type, une comparaison de chaînes ferait passer « 10 » pour
      plus petit que « 3 », et c'est ici que ça se verrait.
    */
    for (let i = 1; i <= 9; i += 1) {
      const decision = await limiteur.checkMysqlLimit('essai', 'alice', 10, FENETRE, T0 + i);
      expect(decision.allowed, `tentative ${i} sur 10`).toBe(true);
    }

    expect((await limiteur.checkMysqlLimit('essai', 'alice', 10, FENETRE, T0 + 10)).allowed).toBe(true);
    expect((await limiteur.checkMysqlLimit('essai', 'alice', 10, FENETRE, T0 + 11)).allowed).toBe(false);
  });

  it('le remboursement rend l’unité : un envoi qui échoue ne doit rien coûter', async () => {
    /*
      Le défaut observé en production. Le budget se prend AVANT l'envoi —
      sinon deux requêtes simultanées passeraient toutes les deux. Mais quand
      l'envoi échoue, la personne n'a rien reçu : sans remboursement, trois
      pannes d'affilée la bloquent un quart d'heure, et le message de blocage
      masque alors la vraie panne.
    */
    for (let i = 1; i <= 3; i += 1) {
      await limiteur.checkMysqlLimit('essai', 'alice', 3, FENETRE, T0 + i);
    }
    expect((await limiteur.checkMysqlLimit('essai', 'alice', 3, FENETRE, T0 + 4)).allowed).toBe(false);

    // Les trois envois avaient échoué : on rend les trois unités.
    for (let i = 0; i < 3; i += 1) await limiteur.refundMysqlLimit('essai', 'alice');

    expect(await lignes()).toBe(0);
    expect((await limiteur.checkMysqlLimit('essai', 'alice', 3, FENETRE, T0 + 5)).allowed).toBe(true);
  });

  it('rembourser un compteur vide ne casse rien', async () => {
    await expect(limiteur.refundMysqlLimit('essai', 'inconnu')).resolves.toBeUndefined();
    expect(await lignes()).toBe(0);
  });

  it('le ménage retire les tentatives sorties de la fenêtre, et elles seules', async () => {
    await limiteur.checkMysqlLimit('essai', 'alice', 5, FENETRE, T0);
    await limiteur.checkMysqlLimit('essai', 'alice', 5, FENETRE, T0 + FENETRE);

    const retirees = await limiteur.purgeRateLimits(FENETRE, T0 + FENETRE + 1_000);

    expect(retirees).toBe(1);
    expect(await lignes()).toBe(1);
  });
});
