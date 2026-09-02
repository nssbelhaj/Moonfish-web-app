import { randomUUID } from 'node:crypto';
import type { Adapter, AdapterAccount, AdapterSession, AdapterUser } from 'next-auth/adapters';

import { execute, query, queryOne, toIso, toMysqlDateTime } from '@/lib/db/mysql';

/**
 * Adaptateur Auth.js pour MySQL.
 *
 * Écrit à la main plutôt que tiré d'un ORM : le projet tient à trois
 * dépendances d'exécution, et cet adaptateur ne fait que traduire une
 * quinzaine d'appels en autant de requêtes de trois lignes. Ajouter un ORM
 * complet pour cela coûterait plus de surface que ce qu'il ferait gagner.
 *
 * Deux pièges qui ne pardonnent pas et que ce fichier traite explicitement :
 *
 *   — LES DATES. MySQL rend un `datetime` sans fuseau ; Auth.js attend des
 *     objets `Date`. Une conversion négligée décale l'expiration des sessions
 *     du décalage horaire du serveur — deux heures en été, soit des sessions
 *     qui meurent trop tôt ou qui survivent trop longtemps, sans que rien ne
 *     le signale ;
 *   — LE JETON À USAGE UNIQUE. `useVerificationToken` doit SUPPRIMER le jeton
 *     en le rendant. S'il se contentait de le lire, un lien de connexion
 *     intercepté resterait utilisable jusqu'à son expiration.
 */

interface UserRow {
  id: string;
  name: string | null;
  email: string | null;
  emailVerified: string | null;
  image: string | null;
}

interface SessionRow {
  id: string;
  sessionToken: string;
  userId: string;
  expires: string;
}

interface VerificationRow {
  identifier: string;
  token: string;
  expires: string;
}

function toUser(row: UserRow): AdapterUser {
  const verified = toIso(row.emailVerified);

  return {
    id: row.id,
    // Auth.js type `email` comme obligatoire alors que la colonne autorise le
    // vide. Une chaîne vide est plus honnête qu'un `null` transtypé : elle ne
    // ressemble pas à une adresse et ne peut pas être confondue avec une.
    email: row.email ?? '',
    emailVerified: verified === null ? null : new Date(verified),
    name: row.name,
    image: row.image,
  };
}

function toSession(row: SessionRow): AdapterSession {
  return {
    sessionToken: row.sessionToken,
    userId: row.userId,
    expires: new Date(toIso(row.expires) as string),
  };
}

export function MysqlAdapter(): Adapter {
  return {
    async createUser(user) {
      const id = user.id && user.id.length > 0 ? user.id : randomUUID();

      await execute(
        'insert into users (id, name, email, emailVerified, image) values (?, ?, ?, ?, ?)',
        [
          id,
          user.name ?? null,
          user.email ?? null,
          user.emailVerified ? toMysqlDateTime(user.emailVerified) : null,
          user.image ?? null,
        ],
      );

      return { ...user, id };
    },

    async getUser(id) {
      const row = await queryOne<UserRow>('select * from users where id = ?', [id]);
      return row ? toUser(row) : null;
    },

    async getUserByEmail(email) {
      const row = await queryOne<UserRow>('select * from users where email = ?', [email]);
      return row ? toUser(row) : null;
    },

    async getUserByAccount({ provider, providerAccountId }) {
      const row = await queryOne<UserRow>(
        `select u.* from users u
         join accounts a on a.userId = u.id
         where a.provider = ? and a.providerAccountId = ?`,
        [provider, providerAccountId],
      );

      return row ? toUser(row) : null;
    },

    async updateUser(user) {
      /*
        Mise à jour PARTIELLE : Auth.js n'envoie que les champs modifiés, et
        écrire les autres à `null` effacerait le nom d'affichage à chaque
        connexion. On construit donc la liste des colonnes à partir de ce qui
        est réellement présent — les noms de colonnes sont des littéraux du
        code, jamais des données, donc rien n'est injectable ici.
      */
      const sets: string[] = [];
      const values: (string | null)[] = [];

      if (user.name !== undefined) {
        sets.push('name = ?');
        values.push(user.name);
      }
      if (user.email !== undefined) {
        sets.push('email = ?');
        values.push(user.email);
      }
      if (user.emailVerified !== undefined) {
        sets.push('emailVerified = ?');
        values.push(user.emailVerified ? toMysqlDateTime(user.emailVerified) : null);
      }
      if (user.image !== undefined) {
        sets.push('image = ?');
        values.push(user.image);
      }

      if (sets.length > 0) {
        await execute(`update users set ${sets.join(', ')} where id = ?`, [...values, user.id]);
      }

      const row = await queryOne<UserRow>('select * from users where id = ?', [user.id]);
      if (!row) throw new Error(`Utilisateur introuvable après mise à jour : ${user.id}`);

      return toUser(row);
    },

    async deleteUser(userId) {
      // Les sessions, comptes et contributions partent par cascade : c'est
      // déclaré dans le schéma, donc impossible à oublier ici.
      await execute('delete from users where id = ?', [userId]);
    },

    async linkAccount(account: AdapterAccount) {
      await execute(
        `insert into accounts
           (id, userId, type, provider, providerAccountId, refresh_token, access_token,
            expires_at, token_type, scope, id_token, session_state)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          randomUUID(),
          account.userId,
          account.type,
          account.provider,
          account.providerAccountId,
          account.refresh_token ?? null,
          account.access_token ?? null,
          account.expires_at ?? null,
          account.token_type ?? null,
          account.scope ?? null,
          account.id_token ?? null,
          typeof account.session_state === 'string' ? account.session_state : null,
        ],
      );

      return account;
    },

    async unlinkAccount({ provider, providerAccountId }) {
      await execute('delete from accounts where provider = ? and providerAccountId = ?', [
        provider,
        providerAccountId,
      ]);
    },

    async createSession(session) {
      await execute('insert into sessions (id, sessionToken, userId, expires) values (?, ?, ?, ?)', [
        randomUUID(),
        session.sessionToken,
        session.userId,
        toMysqlDateTime(session.expires),
      ]);

      return session;
    },

    async getSessionAndUser(sessionToken) {
      const session = await queryOne<SessionRow>('select * from sessions where sessionToken = ?', [
        sessionToken,
      ]);
      if (!session) return null;

      const user = await queryOne<UserRow>('select * from users where id = ?', [session.userId]);
      if (!user) return null;

      return { session: toSession(session), user: toUser(user) };
    },

    async updateSession(session) {
      if (session.expires === undefined && session.userId === undefined) return null;

      const sets: string[] = [];
      const values: string[] = [];

      if (session.expires !== undefined) {
        sets.push('expires = ?');
        values.push(toMysqlDateTime(session.expires));
      }
      if (session.userId !== undefined) {
        sets.push('userId = ?');
        values.push(session.userId);
      }

      await execute(`update sessions set ${sets.join(', ')} where sessionToken = ?`, [
        ...values,
        session.sessionToken,
      ]);

      const row = await queryOne<SessionRow>('select * from sessions where sessionToken = ?', [
        session.sessionToken,
      ]);

      return row ? toSession(row) : null;
    },

    async deleteSession(sessionToken) {
      await execute('delete from sessions where sessionToken = ?', [sessionToken]);
    },

    async createVerificationToken(token) {
      await execute('insert into verification_tokens (identifier, token, expires) values (?, ?, ?)', [
        token.identifier,
        token.token,
        toMysqlDateTime(token.expires),
      ]);

      return token;
    },

    async useVerificationToken({ identifier, token }) {
      const row = await queryOne<VerificationRow>(
        'select * from verification_tokens where identifier = ? and token = ?',
        [identifier, token],
      );

      if (!row) return null;

      // USAGE UNIQUE : le jeton est supprimé au moment où il sert. Auth.js
      // vérifie ensuite l'expiration sur ce qu'on rend ; c'est à nous de
      // garantir qu'il ne servira pas deux fois.
      await execute('delete from verification_tokens where identifier = ? and token = ?', [
        identifier,
        token,
      ]);

      return {
        identifier: row.identifier,
        token: row.token,
        expires: new Date(toIso(row.expires) as string),
      };
    },
  };
}

/**
 * Ménage des sessions et jetons périmés.
 *
 * Sans ce ménage, les deux tables grossissent indéfiniment : Auth.js ne
 * supprime que ce qu'il touche, et un lien de connexion jamais ouvert reste en
 * base pour toujours. Appelé par la tâche planifiée quotidienne.
 */
export async function purgeExpired(): Promise<{ sessions: number; tokens: number }> {
  const now = toMysqlDateTime(new Date());

  const sessions = await execute('delete from sessions where expires < ?', [now]);
  const tokens = await execute('delete from verification_tokens where expires < ?', [now]);

  return { sessions, tokens };
}

/** Sessions d'une personne, pour l'export de ses données. */
export async function sessionsOf(userId: string): Promise<AdapterSession[]> {
  const rows = await query<SessionRow>('select * from sessions where userId = ?', [userId]);
  return rows.map(toSession);
}
