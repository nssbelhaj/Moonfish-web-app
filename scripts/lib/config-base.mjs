/*
  Lecture de la configuration de base de données.

  ─── Pourquoi cette fonction rend un VERDICT plutôt qu'un objet ou `null` ──

  Trois situations se ressemblaient et se confondaient :

    · aucune variable renseignée — c'est un MODE PRÉVU. Le site tourne sans
      comptes et l'annonce ;
    · une variable renseignée mais illisible — c'est une ERREUR DE SAISIE ;
    · une configuration exploitable.

  Les deux premières rendaient `null`, donc le déploiement affichait « aucune
  base configurée : rien à faire », en vert, exit 0 — alors que la variable
  était bien là. Les comptes restaient fermés sans que rien ne désigne la
  cause. Un message faux coûte plus cher qu'un message absent : il envoie
  chercher au mauvais endroit.

  ─── Les caractères qui cassent une URL, et pourquoi c'est fréquent ────────

  Un mot de passe est choisi pour sa force, pas pour sa compatibilité avec la
  grammaire des URL. Or `/`, `?` et `#` y ont un sens : ils terminent
  l'autorité et ouvrent le chemin, la requête ou le fragment. `new URL()` les
  refuse ou tronque. Le `%` est pire — il ne casse rien, il DÉCODE : « GoT%100 »
  devient silencieusement autre chose, et l'échec ressemble à un mot de passe
  refusé par le serveur.

  Le `@`, lui, passe : l'analyseur retient le DERNIER comme séparateur. Il n'y
  a donc rien à encoder pour lui, contrairement à ce qu'on lit souvent.
*/

/** Caractères qui doivent être encodés dans un mot de passe d'URL. */
const CASSANTS = [
  ['/', '%2F'],
  ['?', '%3F'],
  ['#', '%23'],
];

/**
 * @returns {{kind:'absente'}
 *          |{kind:'illisible', raison:string, remede:string}
 *          |{kind:'ok', config:{host:string,port:number,user:string,password:string,database:string}}}
 */
export function lireConfigBase(env = process.env) {
  const url = env.DATABASE_URL?.trim();

  if (url) {
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      const coupable = CASSANTS.find(([c]) => url.includes(c));

      return {
        kind: 'illisible',
        raison: coupable
          ? `DATABASE_URL contient un « ${coupable[0]} », qui a un sens dans une URL.`
          : 'DATABASE_URL n’est pas une URL analysable.',
        remede: coupable
          ? `S’il est dans le mot de passe, écrivez-le « ${coupable[1]} ». Le « @ », lui, n’a rien à encoder.`
          : 'Forme attendue : mysql://utilisateur:motdepasse@hote:3306/base',
      };
    }

    const database = parsed.pathname.replace(/^\//, '');

    if (!parsed.hostname) {
      return {
        kind: 'illisible',
        raison: 'DATABASE_URL n’indique aucun hôte.',
        remede: 'Forme attendue : mysql://utilisateur:motdepasse@hote:3306/base',
      };
    }

    if (!database) {
      return {
        kind: 'illisible',
        raison: 'DATABASE_URL n’indique aucune base — rien après le port.',
        remede: 'Chez Hostinger, le nom ressemble à « u0000000_lunamarea ».',
      };
    }

    let user;
    let password;
    try {
      user = decodeURIComponent(parsed.username);
      password = decodeURIComponent(parsed.password);
    } catch {
      /*
        Un « % » suivi de deux caractères qui ne forment pas un code valide.
        On refuse plutôt que de rendre le mot de passe brut : le rendre tel
        quel marcherait ici et échouerait sur « %41 », qui se décoderait en
        « A » — deux comportements pour la même syntaxe, c'est pire que l'échec.
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
    C'est le cas le plus courant du panneau d'hébergement : on colle l'hôte,
    on est interrompu, et le site repart en mode « sans comptes » sans rien
    dire. Les variables séparées n'ont pas besoin d'encodage : elles ne sont
    pas une URL.
  */
  const manquants = [
    !host && 'MYSQL_HOST',
    !user && 'MYSQL_USER',
    !database && 'MYSQL_DATABASE',
  ].filter(Boolean);

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
      host,
      port: Number.isFinite(port) && port > 0 ? port : 3306,
      user,
      password: env.MYSQL_PASSWORD ?? '',
      database,
    },
  };
}
