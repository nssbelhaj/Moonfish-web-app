import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

/**
 * Prépare le schéma d'une base de test à partir des fichiers de migration.
 *
 * ── Pourquoi ce n'est PAS `scripts/migrer-mysql.mjs` ─────────────────────
 *
 * Le script de migration tient un registre et refuse de rejouer un fichier
 * déjà appliqué. C'est exactement ce qu'il faut en déploiement, et exactement
 * ce dont on ne veut pas ici : chaque fichier de test recrée son schéma sur
 * une base qui peut déjà l'avoir.
 *
 * ── Pourquoi les erreurs sont ignorées ───────────────────────────────────
 *
 * Les `create table if not exists` se rejouent sans bruit. Les `alter table`
 * NON : MySQL rend « Duplicate column name » au second passage. Trois fichiers
 * de test ont cassé le jour où une migration a ajouté une colonne — chacun
 * dupliquait cette boucle, donc chacun demandait la même correction.
 *
 * Ici on prépare un schéma, on ne valide pas un déploiement : c'est
 * `migration-au-demarrage.integration.test.ts` qui exerce le vrai script et
 * ses politiques d'échec.
 */
export async function preparerSchema(db: typeof import('@/lib/db/mysql')): Promise<void> {
  const dir = path.join(process.cwd(), 'db/migrations');
  const fichiers = (await readdir(dir)).filter((nom) => nom.endsWith('.sql')).sort();

  for (const fichier of fichiers) {
    const sql = await readFile(path.join(dir, fichier), 'utf8');

    const instructions = sql
      .split('\n')
      .filter((ligne) => !ligne.trim().startsWith('--'))
      .join('\n')
      .split(';')
      .map((i) => i.trim())
      .filter((i) => i.length > 0);

    for (const instruction of instructions) {
      await db.execute(instruction).catch(() => undefined);
    }
  }
}

/** Vide les tables dans l'ordre des dépendances. Les clés étrangères comptent. */
export async function viderTables(
  db: typeof import('@/lib/db/mysql'),
  tables: readonly string[],
): Promise<void> {
  for (const table of tables) await db.execute(`delete from ${table}`);
}
