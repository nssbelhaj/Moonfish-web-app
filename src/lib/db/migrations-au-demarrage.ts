import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { databaseEnabled, execute, query } from '@/lib/db/mysql';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  Appliquer les migrations au DÉMARRAGE DU SERVEUR, pas avant
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ── Pourquoi `prestart` ne suffit pas ────────────────────────────────────
 *
 * `npm start` déclenche `prestart`, qui lance le script de migration. Cela
 * suppose que l'hébergeur démarre bien par `npm start`. Beaucoup lancent
 * `next start` directement, ou gardent en cache une commande de démarrage
 * plus ancienne. Le crochet ne part alors jamais, sans que rien ne le dise.
 *
 * La panne observée : la base répond, l'application démarre, et il manque
 * toutes les tables. Elle se présente ensuite sous d'autres noms — un
 * compteur d'appels qui « ne répond pas », une inscription qui échoue — et
 * jamais sous le sien.
 *
 * `register()` de Next.js, lui, s'exécute une fois au lancement du serveur
 * QUELLE QUE SOIT la commande. C'est le seul endroit qui ne dépende pas de
 * la configuration de l'hébergeur.
 *
 * ── Deux garanties, et une interdiction ──────────────────────────────────
 *
 * Un VERROU d'avis MySQL empêche deux instances d'appliquer la même migration
 * en même temps. Sans lui, deux démarrages simultanés — un redéploiement en
 * recouvrement — exécuteraient le même `create table` en parallèle.
 *
 * L'échec n'ARRÊTE JAMAIS le démarrage. Marées, météo, carte et guides ne
 * touchent pas la base : les éteindre pour protéger ce qui ne marche pas
 * serait la mauvaise moitié du choix. Le résultat est retenu et rendu par
 * `/api/diagnostic`, qui devient l'endroit où lire ce qui s'est passé.
 */

export interface Bilan {
  /** A-t-on seulement essayé ? `false` sans base configurée. */
  tente: boolean;
  appliquees: string[];
  dejaLa: number;
  /** Message d'erreur si une migration a échoué, sinon `null`. */
  erreur: string | null;
}

let dernier: Bilan = { tente: false, appliquees: [], dejaLa: 0, erreur: null };

/** Ce qui s'est passé au dernier démarrage. Lu par le diagnostic. */
export function bilanDesMigrations(): Bilan {
  return dernier;
}

const VERROU = 'lunamarea_migrations';

/**
 * Dossier des migrations.
 *
 * `process.cwd()` suffit dans les deux dispositions rencontrées : démarrage
 * à la racine du dépôt, et démarrage depuis un dossier de sortie qui garde
 * `db/` à côté. On rend `null` plutôt que de lever si rien n'est trouvé —
 * un dossier absent est une information, pas un plantage.
 */
function dossier(): string | null {
  const candidat = path.join(process.cwd(), 'db/migrations');
  try {
    readdirSync(candidat);
    return candidat;
  } catch {
    return null;
  }
}

/** Découpe un fichier SQL en instructions, commentaires retirés. */
function instructionsDe(sql: string): string[] {
  return sql
    .split('\n')
    .filter((ligne) => !ligne.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map((i) => i.trim())
    .filter((i) => i.length > 0);
}

export async function appliquerMigrationsAuDemarrage(): Promise<Bilan> {
  if (!databaseEnabled()) {
    dernier = { tente: false, appliquees: [], dejaLa: 0, erreur: null };
    return dernier;
  }

  const dir = dossier();
  if (dir === null) {
    dernier = {
      tente: true,
      appliquees: [],
      dejaLa: 0,
      erreur:
        'Le dossier db/migrations/ est introuvable depuis le serveur : il n’a pas été déployé à côté de l’application.',
    };
    return dernier;
  }

  try {
    /*
      Le verrou est pris AVANT toute lecture d'état : entre « quelles
      migrations manquent » et « je les applique », une autre instance
      pourrait avoir tout fait.
    */
    const [verrou] = await query<{ pris: number }>('select get_lock(?, 10) as pris', [VERROU]);
    if (Number(verrou?.pris) !== 1) {
      dernier = {
        tente: true,
        appliquees: [],
        dejaLa: 0,
        erreur: 'Une autre instance applique déjà les migrations : abandon sans rien faire.',
      };
      return dernier;
    }

    try {
      await execute(
        'create table if not exists schema_migrations (' +
          'filename varchar(255) primary key, checksum char(64) not null, ' +
          'applied_at timestamp not null default current_timestamp)',
      );

      const deja = new Set(
        (await query<{ filename: string }>('select filename from schema_migrations')).map(
          (l) => l.filename,
        ),
      );

      const fichiers = readdirSync(dir)
        .filter((nom) => nom.endsWith('.sql'))
        .sort();

      const appliquees: string[] = [];

      for (const fichier of fichiers) {
        if (deja.has(fichier)) continue;

        const sql = readFileSync(path.join(dir, fichier), 'utf8');

        for (const instruction of instructionsDe(sql)) await execute(instruction);

        await execute('insert into schema_migrations (filename, checksum) values (?, ?)', [
          fichier,
          createHash('sha256').update(sql).digest('hex'),
        ]);

        appliquees.push(fichier);
      }

      dernier = { tente: true, appliquees, dejaLa: deja.size, erreur: null };
      return dernier;
    } finally {
      // Le verrou se rend même si une migration a échoué : le laisser pris
      // bloquerait tous les démarrages suivants jusqu'à la fin de la session.
      await query('select release_lock(?)', [VERROU]).catch(() => undefined);
    }
  } catch (error) {
    const detail = (error as { sqlMessage?: string; message?: string }).sqlMessage
      ?? (error instanceof Error ? error.message : String(error));

    dernier = { tente: true, appliquees: [], dejaLa: 0, erreur: detail };
    return dernier;
  }
}
