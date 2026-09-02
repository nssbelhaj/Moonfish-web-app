import mysql from 'mysql2/promise';

/**
 * Accès à MySQL — le SEUL endroit du projet qui ouvre une connexion.
 *
 * ─── Ce que ce module remplace ────────────────────────────────────────────
 *
 * La version PostgreSQL s'appuyait sur la sécurité au niveau des lignes : la
 * base refusait elle-même une écriture au nom d'autrui, et un filtre oublié
 * dans le code ne pouvait pas provoquer de fuite. MySQL n'a pas d'équivalent.
 *
 * La garantie devient donc conventionnelle, et pour qu'une convention vaille
 * quelque chose il faut qu'elle soit vérifiable. D'où :
 *
 *   — tout le SQL du domaine vit dans `src/lib/providers/mysql/` ;
 *   — `src/lib/db/__tests__/proprietaire.test.ts` échoue si une requête
 *     `update` ou `delete` sur une table détenue par un utilisateur ne porte
 *     pas `user_id = ?`, et si du SQL apparaît hors des dossiers autorisés ;
 *   — les paramètres sont TOUJOURS liés, jamais interpolés : `query` n'accepte
 *     pas de fragment construit par concaténation.
 *
 * C'est plus faible qu'une politique appliquée par le moteur, et le dire est
 * plus utile que de faire comme si le modèle de sécurité n'avait pas changé.
 */

export interface MysqlConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

/**
 * Lecture de la configuration.
 *
 * Deux formes acceptées, parce que les hébergeurs ne s'accordent pas : une URL
 * unique (`mysql://user:pass@host:port/base`), ou quatre variables séparées.
 * Hostinger câble les identifiants automatiquement dans l'application ; ce
 * module s'adapte à ce qu'il trouve plutôt que d'imposer un format.
 */
function readConfig(): MysqlConfig | null {
  const url = process.env.DATABASE_URL?.trim();

  if (url) {
    try {
      const parsed = new URL(url);
      const database = parsed.pathname.replace(/^\//, '');
      if (!parsed.hostname || !database) return null;

      return {
        host: parsed.hostname,
        port: parsed.port ? Number(parsed.port) : 3306,
        user: decodeURIComponent(parsed.username),
        password: decodeURIComponent(parsed.password),
        database,
      };
    } catch {
      console.warn('[db] DATABASE_URL est inexploitable : base considérée absente.');
      return null;
    }
  }

  const host = process.env.MYSQL_HOST?.trim();
  const user = process.env.MYSQL_USER?.trim();
  const database = process.env.MYSQL_DATABASE?.trim();
  if (!host || !user || !database) return null;

  const port = Number(process.env.MYSQL_PORT ?? 3306);

  return {
    host,
    port: Number.isFinite(port) && port > 0 ? port : 3306,
    user,
    password: process.env.MYSQL_PASSWORD ?? '',
    database,
  };
}

export const MYSQL_CONFIG: MysqlConfig | null = readConfig();

/** La base est-elle configurée ? Décide de l'ouverture des comptes. */
export function databaseEnabled(): boolean {
  return MYSQL_CONFIG !== null;
}

let pool: mysql.Pool | null = null;

/**
 * Réserve de connexions, créée une seule fois.
 *
 * `connectionLimit` est volontairement bas : un hébergement mutualisé plafonne
 * les connexions simultanées, et une réserve trop large fait échouer les
 * requêtes au pire moment — sous charge — avec une erreur qui ne désigne pas
 * la cause.
 */
export function getPool(): mysql.Pool | null {
  if (MYSQL_CONFIG === null) return null;
  if (pool) return pool;

  pool = mysql.createPool({
    ...MYSQL_CONFIG,
    waitForConnections: true,
    connectionLimit: Number(process.env.MYSQL_POOL_SIZE ?? 5),
    // Les dates sont converties en chaînes plutôt qu'en objets `Date` : le
    // pilote applique sinon le fuseau du PROCESSUS, ce qui décale les
    // horodatages selon l'endroit où tourne le serveur. On lit du texte, on
    // décide nous-mêmes.
    dateStrings: true,
    timezone: 'Z',
    charset: 'utf8mb4_unicode_ci',
    namedPlaceholders: false,
  });

  return pool;
}

/** Ferme la réserve. Réservé aux tests : la production garde ses connexions. */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

/**
 * Valeurs qu'une requête préparée accepte.
 *
 * Plus étroit que `unknown` à dessein : passer un objet par erreur — un
 * `Date`, un tableau, le résultat d'un `JSON.parse` — produirait sinon une
 * erreur de pilote incompréhensible au moment de l'exécution, alors que le
 * compilateur peut la refuser tout de suite.
 */
export type SqlParam = string | number | boolean | null | Date;

export class DatabaseUnavailable extends Error {
  constructor() {
    super('Aucune base de données configurée.');
    this.name = 'DatabaseUnavailable';
  }
}

/**
 * Exécute une requête préparée.
 *
 * `params` est obligatoire dès qu'il y a un `?`. Il n'existe volontairement
 * aucun chemin permettant de passer une requête construite par concaténation :
 * c'est la seule protection contre l'injection qui ne dépende pas de la
 * vigilance de celui qui écrit.
 */
export async function query<T>(sql: string, params: readonly SqlParam[] = []): Promise<T[]> {
  const active = getPool();
  if (!active) throw new DatabaseUnavailable();

  const [rows] = await active.execute(sql, [...params]);
  return rows as T[];
}

/** Première ligne, ou `null`. Évite le `rows[0] ?? null` répété partout. */
export async function queryOne<T>(
  sql: string,
  params: readonly SqlParam[] = [],
): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

/** Nombre de lignes touchées par une écriture. */
export async function execute(sql: string, params: readonly SqlParam[] = []): Promise<number> {
  const active = getPool();
  if (!active) throw new DatabaseUnavailable();

  const [result] = await active.execute(sql, [...params]);
  return (result as mysql.ResultSetHeader).affectedRows;
}

/**
 * Convertit un `datetime(3)` MySQL en instant ISO.
 *
 * MySQL rend « 2026-09-01 16:30:00.000 » sans fuseau. Les colonnes sont
 * écrites en UTC — c'est la règle du projet, appliquée à l'écriture — donc on
 * ajoute le « Z » qui manque. L'oublier ferait interpréter chaque horodatage
 * dans le fuseau du serveur, et décalerait les prises de deux heures en été.
 */
export function toIso(value: string | Date | null): string | null {
  if (value === null) return null;
  if (value instanceof Date) return value.toISOString();

  const normalised = value.includes('T') ? value : value.replace(' ', 'T');
  const withZone = /[Zz]|[+-]\d{2}:?\d{2}$/.test(normalised) ? normalised : `${normalised}Z`;
  const parsed = new Date(withZone);

  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

/** Instant ISO → littéral `datetime(3)` en UTC, pour l'écriture. */
export function toMysqlDateTime(iso: string | Date): string {
  const date = typeof iso === 'string' ? new Date(iso) : iso;
  return date.toISOString().slice(0, 23).replace('T', ' ');
}
