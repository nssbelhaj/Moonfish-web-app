import { readdirSync } from 'node:fs';
import path from 'node:path';

import { databaseEnabled, query } from '@/lib/db/mysql';
import { bilanDesMigrations } from '@/lib/db/migrations-au-demarrage';
import type { Point } from './etat';

/**
 * Les migrations ont-elles vraiment été appliquées sur CE déploiement ?
 *
 * ── Pourquoi la question se pose ─────────────────────────────────────────
 *
 * Les migrations partent avec `prestart`, donc avec `npm start`. Un
 * hébergeur qui lance directement `next start` — ou qui a mis en cache une
 * commande de démarrage plus ancienne — saute cette étape sans rien dire. La
 * base répond, l'application démarre, et il manque des tables.
 *
 * La panne prend alors le visage d'autre chose. Une table `rate_limits`
 * absente fait échouer le compteur d'appels ; le compteur refuse par sécurité,
 * et le formulaire de connexion répond « trop de demandes, réessayez dans
 * quinze minutes ». On attend, on revient, et c'est le même message. Rien ne
 * mentionne les migrations.
 */
export async function etatMigrations(): Promise<Point> {
  if (!databaseEnabled()) {
    return {
      sujet: 'Migrations de la base',
      etat: 'absent',
      constat: 'Aucune base configurée : rien à vérifier.',
      remede: 'Définissez DATABASE_URL.',
    };
  }

  /*
    `db/migrations/` peut ne pas être présent à côté du serveur : certains
    hébergeurs ne déploient que le résultat de la compilation. Sans ce garde,
    le diagnostic tomberait en erreur — précisément l'outil qu'on vient
    consulter quand plus rien ne marche.
  */
  let attendues: string[];
  try {
    attendues = readdirSync(path.join(process.cwd(), 'db/migrations'))
      .filter((nom) => nom.endsWith('.sql'))
      .sort();
  } catch {
    attendues = [];
  }

  let appliquees: string[];
  try {
    const lignes = await query<{ filename: string }>('select filename from schema_migrations');
    appliquees = lignes.map((l) => l.filename).sort();
  } catch {
    /*
      La table de suivi elle-même est absente : aucune migration n'est jamais
      passée sur cette base. C'est le cas le plus grave et le plus silencieux.
    */
    return {
      sujet: 'Migrations de la base',
      etat: 'absent',
      constat:
        'La table de suivi `schema_migrations` n’existe pas : AUCUNE migration n’a été appliquée. La base répond, mais elle est vide — comptes, contributions et compteurs d’appels échoueront tous, chacun sous un autre déguisement.',
      remede:
        'Redéployez : le serveur applique désormais les migrations lui-même au démarrage, quelle que soit la commande de lancement. Si elles manquent encore après un redéploiement, ce diagnostic portera le message d’erreur de MySQL.',
    };
  }

  if (attendues.length === 0) {
    return {
      sujet: 'Migrations de la base',
      etat: 'attention',
      constat: `${appliquees.length} migration(s) enregistrée(s) en base, mais le dossier db/migrations/ n’est pas lisible depuis le serveur : impossible de dire s’il en manque.`,
      remede: 'Vérifiez que db/migrations/ est bien déployé à côté de l’application.',
    };
  }

  const manquantes = attendues.filter((nom) => !appliquees.includes(nom));
  const bilan = bilanDesMigrations();

  /*
    L'échec du démarrage prime sur le décompte : il porte le message du
    serveur MySQL, qui nomme la cause réelle — un droit manquant, une
    contrainte refusée — là où « il manque deux migrations » ne dit que le
    symptôme.
  */
  if (bilan.erreur !== null) {
    return {
      sujet: 'Migrations de la base',
      etat: 'absent',
      constat: `L’application des migrations a ÉCHOUÉ au démarrage. MySQL répond : « ${bilan.erreur} »`,
      remede:
        'Le message ci-dessus vient du serveur de base. S’il parle de droits, l’utilisateur MySQL n’a pas le droit de créer des tables ; s’il parle de syntaxe, la version du serveur est plus ancienne qu’attendu.',
    };
  }

  return manquantes.length === 0
    ? {
        sujet: 'Migrations de la base',
        etat: 'ok',
        constat:
          `Les ${attendues.length} migrations sont appliquées (jusqu’à ${attendues.at(-1)}).` +
          (bilan.appliquees.length > 0
            ? ` ${bilan.appliquees.length} l’ont été au dernier démarrage : ${bilan.appliquees.join(', ')}.`
            : ''),
        remede: null,
      }
    : {
        sujet: 'Migrations de la base',
        etat: 'absent',
        constat: `${manquantes.length} migration(s) non appliquée(s) : ${manquantes.join(', ')}. Les fonctions qui en dépendent échoueront sans nommer la cause.`,
        remede:
          'Le serveur les applique normalement de lui-même au démarrage. Si elles manquent encore, redéployez et relisez ce diagnostic : le point ci-dessus portera alors le message d’erreur de MySQL.',
      };
}
