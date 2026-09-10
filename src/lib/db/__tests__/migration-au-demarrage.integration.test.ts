import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const run = promisify(execFile);

/*
  ────────────────────────────────────────────────────────────────────────────
   Ce que ces tests protègent : que le site RESTE EN LIGNE.

   La politique d'origine arrêtait le démarrage sur une migration en échec,
   au motif que la version précédente resterait en ligne. Sur un hébergement
   mutualisé, il n'y a pas de version précédente : le processus sort en 1,
   l'hébergeur le relance, il ressort en 1, et le serveur rend un 503 sur TOUT
   le site — marées, météo, carte et guides compris, qui ne touchent jamais la
   base.

   Observé en production. Ces tests fixent les trois comportements.
  ────────────────────────────────────────────────────────────────────────────
*/

const DATABASE_URL = process.env.DATABASE_URL;
const describeDb = DATABASE_URL ? describe : describe.skip;

describeDb('la politique d’échec des migrations', () => {
  let db: typeof import('@/lib/db/mysql');
  let url = '';

  /** Lance le script et rend son code de sortie, sans jamais lever. */
  async function sortie(args: string[], env: Record<string, string> = {}): Promise<number> {
    try {
      await run('node', ['scripts/migrer-mysql.mjs', ...args], {
        env: { ...process.env, DATABASE_URL: url, ...env },
      });
      return 0;
    } catch (error) {
      return (error as { code?: number }).code ?? -1;
    }
  }

  beforeAll(async () => {
    db = await import('@/lib/db/mysql');

    // Une base où 0001 est déclarée appliquée avec une empreinte FAUSSE :
    // le script doit refuser d'aller plus loin.
    const base = `lm_politique_${Date.now()}`;
    await db.execute(`create database ${base}`);
    url = DATABASE_URL!.replace(/\/[^/]*$/, `/${base}`);

    const enPanne = await import('mysql2/promise');
    const c = await enPanne.createConnection(url);
    await c.execute(
      'create table schema_migrations (filename varchar(255) primary key, checksum char(64) not null, applied_at timestamp default current_timestamp)',
    );
    await c.execute('insert into schema_migrations (filename, checksum) values (?, ?)', [
      '0001_comptes_et_contributions.sql',
      '0'.repeat(64),
    ]);
    await c.end();
  });

  afterAll(async () => {
    const base = url.slice(url.lastIndexOf('/') + 1);
    await db.execute(`drop database if exists ${base}`);
    await db.closePool();
  });

  it('au démarrage : DÉMARRE QUAND MÊME — un schéma incomplet vaut mieux qu’un 503 total', async () => {
    expect(await sortie(['--au-demarrage'])).toBe(0);
  });

  it('en manuel : échoue — on a demandé une migration, on veut savoir', async () => {
    expect(await sortie([])).toBe(1);
  });

  it('MIGRATIONS_STRICT=1 rétablit l’arrêt, pour qui garde vraiment une version précédente', async () => {
    expect(await sortie(['--au-demarrage'], { MIGRATIONS_STRICT: '1' })).toBe(1);
  });
});
