/**
 * Lecture de la configuration de base de données.
 *
 * ─── Pourquoi un VERDICT plutôt qu'un objet ou `null` ─────────────────────
 *
 * Trois situations se ressemblaient et se confondaient :
 *
 *   · aucune variable renseignée — c'est un MODE PRÉVU. Le site tourne sans
 *     comptes et l'annonce ;
 *   · une variable renseignée mais illisible — c'est une ERREUR DE SAISIE ;
 *   · une configuration exploitable.
 *
 * Les deux premières rendaient `null`. Le déploiement affichait donc « aucune
 * base configurée : rien à faire », en vert, alors que la variable était bien
 * là — et les comptes restaient fermés sans que rien ne désigne la cause. Un
 * message faux coûte plus cher qu'un message absent : il envoie chercher au
 * mauvais endroit.
 *
 * ─── Le jumeau en JavaScript ──────────────────────────────────────────────
 *
 * `scripts/lib/config-base.mjs` fait la même chose pour le script de
 * migration, qui tourne hors de TypeScript. Deux implémentations d'une même
 * règle divergent toujours ; `__tests__/config.test.ts` les compare sur une
 * table de cas et échoue au premier désaccord.
 */

export interface MysqlConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

export type ConfigVerdict =
  | { kind: 'absente' }
  | { kind: 'illisible'; raison: string; remede: string }
  | { kind: 'ok'; config: MysqlConfig };

/**
 * Caractères qui doivent être encodés dans un mot de passe d'URL.
 *
 * `/`, `?` et `#` terminent l'autorité et ouvrent le chemin, la requête ou le
 * fragment : `new URL()` les refuse ou tronque. Le `@` n'y figure pas —
 * l'analyseur retient le DERNIER comme séparateur, donc il passe tel quel,
 * contrairement à ce qu'on lit souvent.
 */
const CASSANTS: readonly (readonly [string, string])[] = [
  ['/', '%2F'],
  ['?', '%3F'],
  ['#', '%23'],
];

const FORME = 'Forme attendue : mysql://utilisateur:motdepasse@hote:3306/base';

/** Plus étroit que `NodeJS.ProcessEnv`, qui exige `NODE_ENV` : les tests
 * construisent des environnements minimaux, et n'ont pas à le simuler. */
export type Environnement = Readonly<Record<string, string | undefined>>;

export function lireConfigBase(env: Environnement = process.env): ConfigVerdict {
  const url = env.DATABASE_URL?.trim();

  if (url) {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      const coupable = CASSANTS.find(([caractere]) => url.includes(caractere));

      return coupable
        ? {
            kind: 'illisible',
            raison: `DATABASE_URL contient un « ${coupable[0]} », qui a un sens dans une URL.`,
            remede: `S’il est dans le mot de passe, écrivez-le « ${coupable[1]} ». Le « @ », lui, n’a rien à encoder.`,
          }
        : { kind: 'illisible', raison: 'DATABASE_URL n’est pas une URL analysable.', remede: FORME };
    }

    const database = parsed.pathname.replace(/^\//, '');

    if (!parsed.hostname) {
      return { kind: 'illisible', raison: 'DATABASE_URL n’indique aucun hôte.', remede: FORME };
    }

    if (!database) {
      return {
        kind: 'illisible',
        raison: 'DATABASE_URL n’indique aucune base — rien après le port.',
        remede: 'Chez Hostinger, le nom ressemble à « u0000000_moonfish ».',
      };
    }

    let user: string;
    let password: string;
    try {
      user = decodeURIComponent(parsed.username);
      password = decodeURIComponent(parsed.password);
    } catch {
      /*
        Un « % » suivi de deux caractères qui ne forment pas un code valide. On
        refuse plutôt que de rendre la chaîne brute : la rendre telle quelle
        marcherait ici et échouerait sur « %41 », qui se décoderait en « A » —
        deux comportements pour la même syntaxe est pire que l'échec.
      */
      return {
        kind: 'illisible',
        raison: 'DATABASE_URL contient un « % » qui ne forme pas un code valide.',
        remede: 'Un « % » littéral dans un mot de passe s’écrit « %25 ».',
      };
    }

    const port = parsed.port ? Number(parsed.port) : 3306;

    return {
      kind: 'ok',
      config: {
        host: parsed.hostname,
        port: Number.isFinite(port) && port > 0 ? port : 3306,
        user,
        password,
        database,
      },
    };
  }

  const host = env.MYSQL_HOST?.trim();
  const user = env.MYSQL_USER?.trim();
  const database = env.MYSQL_DATABASE?.trim();

  if (!host && !user && !database) return { kind: 'absente' };

  /*
    Renseigner UNE des trois et pas les autres est une erreur, pas une absence.
    C'est le cas courant du panneau d'hébergement : on colle l'hôte, on est
    interrompu, et le site repart en mode « sans comptes » sans rien dire. Les
    variables séparées n'ont pas besoin d'encodage : elles ne sont pas une URL.
  */
  const manquants = [
    host ? null : 'MYSQL_HOST',
    user ? null : 'MYSQL_USER',
    database ? null : 'MYSQL_DATABASE',
  ].filter((name): name is string => name !== null);

  if (manquants.length > 0) {
    return {
      kind: 'illisible',
      raison: `Configuration incomplète : ${manquants.join(', ')} manque${manquants.length > 1 ? 'nt' : ''}.`,
      remede: 'Renseignez les trois, ou utilisez DATABASE_URL seule.',
    };
  }

  const port = Number(env.MYSQL_PORT ?? 3306);

  return {
    kind: 'ok',
    config: {
      host: host as string,
      port: Number.isFinite(port) && port > 0 ? port : 3306,
      user: user as string,
      password: env.MYSQL_PASSWORD ?? '',
      database: database as string,
    },
  };
}
