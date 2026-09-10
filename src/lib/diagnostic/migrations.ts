import { readdirSync } from 'node:fs';
import path from 'node:path';

import { databaseEnabled, query } from '@/lib/db/mysql';
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
        'Le démarrage doit passer par `npm start` (qui déclenche `prestart` → migrations), pas par `next start` directement. Vérifiez la commande de démarrage de l’application, puis redéployez.',
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

  return manquantes.length === 0
    ? {
        sujet: 'Migrations de la base',
        etat: 'ok',
        constat: `Les ${attendues.length} migrations sont appliquées (jusqu’à ${attendues.at(-1)}).`,
        remede: null,
      }
    : {
        sujet: 'Migrations de la base',
        etat: 'absent',
        constat: `${manquantes.length} migration(s) non appliquée(s) : ${manquantes.join(', ')}. Les fonctions qui en dépendent échoueront sans nommer la cause.`,
        remede:
          'Redéployez en vous assurant que le démarrage passe par `npm start`. En dernier recours, `npm run migrate` depuis un terminal SSH.',
      };
}
