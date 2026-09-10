import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/*
  ────────────────────────────────────────────────────────────────────────────
   Les migrations doivent partir au démarrage du SERVEUR, pas du script.

   `prestart` suppose que l'hébergeur lance `npm start`. Beaucoup lancent
   `next start` directement : le crochet ne part jamais, la base répond,
   l'application démarre, et il manque toutes les tables. La panne se présente
   ensuite sous d'autres noms — un compteur d'appels « qui ne répond pas »,
   une inscription qui échoue — et jamais sous le sien. Observé en production.

   `register()` de Next s'exécute quelle que soit la commande. Ces tests
   vérifient ce que fait la fonction qu'il appelle.
  ────────────────────────────────────────────────────────────────────────────
*/

const DATABASE_URL = process.env.DATABASE_URL;
const describeDb = DATABASE_URL ? describe : describe.skip;

describeDb('les migrations au démarrage', () => {
  let db: typeof import('@/lib/db/mysql');
  let base = '';

  beforeAll(async () => {
    db = await import('@/lib/db/mysql');
    base = `lm_dem_${randomUUID().slice(0, 8)}`;
    await db.execute(`create database ${base}`);
  });

  afterAll(async () => {
    await db.execute(`drop database if exists ${base}`);
    await db.closePool();
  });

  /** Recharge le module contre une base neuve : sa configuration est lue au chargement. */
  async function surBaseNeuve(): Promise<{
    migrations: typeof import('../migrations-au-demarrage');
    mysql: typeof import('@/lib/db/mysql');
  }> {
    const { vi } = await import('vitest');
    vi.resetModules();

    const precedent = process.env['DATABASE_URL'];
    process.env['DATABASE_URL'] = precedent!.replace(/\/[^/]*$/, `/${base}`);

    const migrations = await import('../migrations-au-demarrage');
    const mysql = await import('@/lib/db/mysql');

    return { migrations, mysql };
  }

  it('applique TOUT sur une base vide', async () => {
    const { migrations, mysql } = await surBaseNeuve();
    const bilan = await migrations.appliquerMigrationsAuDemarrage();

    expect(bilan.erreur).toBeNull();
    expect(bilan.appliquees.length).toBeGreaterThanOrEqual(4);
    expect(bilan.dejaLa).toBe(0);

    const tables = await mysql.query<Record<string, string>>('show tables');
    const noms = tables.map((t) => Object.values(t)[0]);

    for (const attendue of ['users', 'profiles', 'user_credentials', 'rate_limits', 'password_resets']) {
      expect(noms, attendue).toContain(attendue);
    }
    await mysql.closePool();
  });

  it('ne rejoue rien au second démarrage', async () => {
    const { migrations, mysql } = await surBaseNeuve();
    const bilan = await migrations.appliquerMigrationsAuDemarrage();

    expect(bilan.erreur).toBeNull();
    expect(bilan.appliquees).toStrictEqual([]);
    expect(bilan.dejaLa).toBeGreaterThanOrEqual(4);
    await mysql.closePool();
  });

  it('retient son bilan pour le diagnostic', async () => {
    const { migrations, mysql } = await surBaseNeuve();
    await migrations.appliquerMigrationsAuDemarrage();

    // C'est ce bilan que `/api/diagnostic` rend : sans lui, l'échec ne serait
    // lisible que dans des journaux qu'on ne sait pas atteindre.
    expect(migrations.bilanDesMigrations().tente).toBe(true);
    await mysql.closePool();
  });

  it('deux démarrages simultanés ne se marchent pas dessus', async () => {
    /*
      Un redéploiement en recouvrement lance deux instances ensemble. Sans le
      verrou d'avis, elles exécuteraient le même `create table` en parallèle.
      L'une doit faire le travail, l'autre constater et passer.
    */
    const autre = `${base}_paralleles`;
    await db.execute(`drop database if exists ${autre}`);
    await db.execute(`create database ${autre}`);

    const { vi } = await import('vitest');
    vi.resetModules();
    process.env['DATABASE_URL'] = DATABASE_URL!.replace(/\/[^/]*$/, `/${autre}`);

    const migrations = await import('../migrations-au-demarrage');
    const mysql = await import('@/lib/db/mysql');

    const [a, b] = await Promise.all([
      migrations.appliquerMigrationsAuDemarrage(),
      migrations.appliquerMigrationsAuDemarrage(),
    ]);

    // Aucune des deux ne casse, et le schéma est complet.
    for (const bilan of [a, b]) expect(bilan.erreur === null || bilan.erreur.includes('autre instance')).toBe(true);

    const tables = await mysql.query<Record<string, string>>('show tables');
    expect(tables.map((t) => Object.values(t)[0])).toContain('user_credentials');

    await mysql.closePool();
    await db.execute(`drop database if exists ${autre}`);
  });
});
