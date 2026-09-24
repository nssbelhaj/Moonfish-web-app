import mysql from 'mysql2/promise';

import { execute, MYSQL_CONFIG, query, toIso, toMysqlDateTime } from '@/lib/db/mysql';
import type { TideExtreme } from '@/lib/forecast/tide-coefficient';

import type { TableDeMaree, TideTableStore } from '../marees/store';

interface Ligne {
  point_slug: string;
  covers_from: string | Date;
  covers_to: string | Date;
  extremes: string;
  source_name: string;
  fetched_at: string | Date;
}

function versTable(ligne: Ligne): TableDeMaree | null {
  let extremes: unknown;
  try {
    extremes = JSON.parse(ligne.extremes);
  } catch {
    return null;
  }
  if (!Array.isArray(extremes)) return null;

  const coversFrom = toIso(ligne.covers_from);
  const coversTo = toIso(ligne.covers_to);
  const fetchedAt = toIso(ligne.fetched_at);
  if (coversFrom === null || coversTo === null || fetchedAt === null) return null;

  return {
    pointSlug: ligne.point_slug,
    coversFrom,
    coversTo,
    extremes: extremes as TideExtreme[],
    sourceName: ligne.source_name,
    fetchedAt,
  };
}

/**
 * Les tables de marée dans MySQL — voir la migration 0008.
 *
 * Une ligne illisible (JSON corrompu, date absente) est rendue comme
 * ABSENTE, pas comme une erreur : le fournisseur la redemandera, ce qui est
 * exactement ce qu'il faut faire d'une ligne corrompue.
 */
export class MysqlTideTableStore implements TideTableStore {
  async lire(pointSlug: string): Promise<TableDeMaree | null> {
    const lignes = await query<Ligne>('select * from tide_tables where point_slug = ?', [pointSlug]);
    const ligne = lignes[0];
    return ligne ? versTable(ligne) : null;
  }

  async ecrire(table: TableDeMaree): Promise<void> {
    await execute(
      `insert into tide_tables (point_slug, covers_from, covers_to, extremes, source_name, fetched_at)
         values (?, ?, ?, ?, ?, ?)
         on duplicate key update
           covers_from = values(covers_from),
           covers_to = values(covers_to),
           extremes = values(extremes),
           source_name = values(source_name),
           fetched_at = values(fetched_at)`,
      [
        table.pointSlug,
        toMysqlDateTime(table.coversFrom),
        toMysqlDateTime(table.coversTo),
        JSON.stringify(table.extremes),
        table.sourceName,
        toMysqlDateTime(table.fetchedAt),
      ],
    );
  }

  async toutes(): Promise<TableDeMaree[]> {
    const lignes = await query<Ligne>('select * from tide_tables order by covers_to asc');
    return lignes.map(versTable).filter((table): table is TableDeMaree => table !== null);
  }

  /** Une file par point et par processus : un seul attend le verrou en base à la fois. */
  private readonly files = new Map<string, Promise<unknown>>();

  /**
   * Verrou d'avis MySQL, sur une connexion DÉDIÉE.
   *
   * ─── Pourquoi pas une connexion de la réserve ─────────────────────────
   *
   * Première version : `pool.getConnection()`, `get_lock` dessus. Au build,
   * cinq rendus manquaient Brest en même temps ; les cinq prenaient une
   * connexion de la réserve — qui en compte cinq — et quatre s'y bloquaient
   * dans `get_lock`. Le cinquième, détenteur du verrou, demandait alors une
   * SIXIÈME connexion pour relire la table : il n'y en avait plus. Personne
   * n'avançait ; chaque page dépassait soixante secondes ; le build tombait.
   *
   * D'où deux règles : une file EN MÉMOIRE par point, pour qu'un seul appel
   * par processus attende en base ; et une connexion ouverte pour le verrou
   * seul, hors réserve, rendue à la fin. Le travail sous le verrou — relire,
   * demander, écrire — passe par la réserve, qui est libre.
   *
   * Sans configuration, ou si la connexion dédiée échoue, `fn` s'exécute
   * sans verrou : le pire cas est une requête en double, jamais une page
   * sans marée.
   */
  verrou<T>(pointSlug: string, fn: () => Promise<T>): Promise<T> {
    const precedent = this.files.get(pointSlug) ?? Promise.resolve();
    const suivant = precedent.catch(() => undefined).then(() => this.sousVerrouEnBase(pointSlug, fn));
    this.files.set(pointSlug, suivant);
    return suivant;
  }

  private async sousVerrouEnBase<T>(pointSlug: string, fn: () => Promise<T>): Promise<T> {
    if (MYSQL_CONFIG === null) return fn();

    let connexion: mysql.Connection;
    try {
      connexion = await mysql.createConnection({ ...MYSQL_CONFIG, timezone: 'Z' });
    } catch {
      return fn();
    }

    const nom = `lunamarea_maree_${pointSlug}`.slice(0, 64);
    let pris = false;
    try {
      const [lignes] = await connexion.query('select get_lock(?, 20) as pris', [nom]);
      pris = Number((lignes as { pris: unknown }[])[0]?.pris) === 1;
      return await fn();
    } finally {
      if (pris) await connexion.query('select release_lock(?)', [nom]).catch(() => undefined);
      await connexion.end().catch(() => undefined);
    }
  }
}
