#!/usr/bin/env node
/*
  Applique les migrations SQL à la base configurée.

    node scripts/migrer-mysql.mjs                 (manuel)
    node scripts/migrer-mysql.mjs --au-demarrage  (avant `next start`)

  ─── Ce que ce script garantit ─────────────────────────────────────────────

  Chaque fichier de `db/migrations/` est appliqué UNE SEULE FOIS, dans l'ordre
  de son nom, et la trace est gardée dans la table `schema_migrations`.

  Sans ce suivi, les migrations étaient rejouées à chaque déploiement. Cela
  marchait tant que tout était en « create table if not exists » ; la première
  qui ajoutera une colonne ou renommera quelque chose échouerait au deuxième
  passage, et l'échec arriverait en pleine mise en ligne.

  Le script vérifie aussi l'EMPREINTE des fichiers déjà appliqués. Modifier une
  migration passée est la façon la plus discrète de faire diverger deux
  environnements : la base de production garde l'ancienne forme, le dépôt
  affiche la nouvelle, et plus personne ne sait laquelle fait foi. Le script
  refuse et le dit.

  ─── Politique d'échec, et pourquoi elle diffère selon le contexte ─────────

  Au démarrage (`--au-demarrage`) :
    · pas de base configurée   → on passe, sans bruit. Le site tourne sans
      comptes, c'est un mode prévu ;
    · base injoignable         → AVERTISSEMENT, et on démarre quand même ;
    · migration en échec       → AVERTISSEMENT, et on démarre quand même.

  ─── Pourquoi le dernier point a CHANGÉ ────────────────────────────────────

  Il valait « ARRÊT », avec ce raisonnement : faire tourner du code contre un
  schéma à moitié migré corrompt des données en silence, mieux vaut que le
  déploiement échoue et que la version précédente reste en ligne.

  Le raisonnement était juste ; sa PRÉMISSE ne l'est pas ici. Sur un
  hébergement mutualisé, aucune version précédente ne reste en ligne : le
  processus sort en 1, l'hébergeur le relance, il ressort en 1, et le serveur
  finit par rendre un 503 sur TOUT le site — y compris les marées, la météo,
  la carte et les guides, qui ne touchent jamais la base. Observé en
  production : une seule migration en échec, et il ne reste plus rien.

  Le risque qui justifiait l'arrêt n'est par ailleurs plus silencieux. Les
  chemins qui ont besoin d'une table absente refusent maintenant en nommant la
  cause (« les migrations n'ont probablement pas été appliquées »), et
  `/api/diagnostic` compare `schema_migrations` aux fichiers présents.

  `MIGRATIONS_STRICT=1` rétablit l'arrêt, pour un hébergeur qui sait vraiment
  garder la version précédente en ligne.

  En manuel, l'échec reste une erreur : on a demandé une migration, on veut
  savoir qu'elle n'est pas passée.
*/

import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import mysql from 'mysql2/promise';

import { lireConfigBase } from './lib/config-base.mjs';

const AT_STARTUP = process.argv.includes('--au-demarrage');

/** Au démarrage, un échec avertit et laisse partir — sauf demande contraire. */
const STRICT = !AT_STARTUP || process.env.MIGRATIONS_STRICT === '1';

/**
 * Sortie sur échec de migration.
 *
 * Rendre 1 au démarrage d'un hébergement mutualisé, c'est éteindre le site
 * entier pour protéger la partie qui a besoin de la base. Le reste — marées,
 * météo, carte, guides — n'a rien demandé.
 */
function terminerSurEchec(connection) {
  if (STRICT) return connection.end().then(() => process.exit(1));

  console.error(
    '\n[migration] LE SITE DÉMARRE QUAND MÊME, avec un schéma incomplet.\n' +
      'Les comptes et les contributions échoueront en nommant cette cause ;\n' +
      'le reste du site fonctionne. Diagnostic : /api/diagnostic\n' +
      'Pour arrêter le démarrage sur cette erreur : MIGRATIONS_STRICT=1',
  );
  return connection.end();
}

function loadEnvFile() {
  try {
    for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
      const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
      }
    }
  } catch {
    // Pas de fichier : les variables viennent de l'environnement.
  }
}

loadEnvFile();

/** Découpe un fichier SQL en instructions exécutables une à une. */
function statementsOf(sql) {
  return (
    sql
      .split('\n')
      // Les commentaires sont retirés AVANT le découpage : un « ; » dans une
      // phrase française couperait sinon une instruction en deux.
      .filter((line) => !line.trim().startsWith('--'))
      .join('\n')
      .split(';')
      .map((statement) => statement.trim())
      .filter((statement) => statement.length > 0)
  );
}

const verdict = lireConfigBase();

/*
  Une variable RENSEIGNÉE MAIS ILLISIBLE n'est pas une absence, et les
  confondre était un vrai défaut : le déploiement affichait « aucune base
  configurée : rien à faire », en vert et exit 0, alors que DATABASE_URL était
  bien là. Les comptes restaient fermés sans que rien ne désigne la cause, et
  on allait chercher du côté du serveur MySQL — au mauvais endroit.
*/
if (verdict.kind === 'illisible') {
  console.error(
    `\n[migration] ${verdict.raison}\n` +
      `[migration] ${verdict.remede}\n` +
      '[migration] Ce n’est PAS le mode « sans base » : une variable est posée mais inexploitable.',
  );

  // Au démarrage, on n'arrête pas le site pour autant : marées, météo, guides
  // et score n'ont pas besoin de la base. Mais le message, lui, est écrit sur
  // le canal d'erreur et nomme la cause.
  process.exit(AT_STARTUP ? 0 : 2);
}

if (verdict.kind === 'absente') {
  if (AT_STARTUP) {
    console.log('[migration] aucune base configurée : rien à faire.');
    process.exit(0);
  }

  console.error(
    'Aucune base configurée.\n' +
      'Renseignez DATABASE_URL (ou MYSQL_HOST / MYSQL_USER / MYSQL_PASSWORD / MYSQL_DATABASE)\n' +
      'dans .env.local — voir .env.example.',
  );
  process.exit(2);
}

const settings = verdict.config;

let connection;
try {
  connection = await mysql.createConnection({ ...settings, connectTimeout: 10_000 });
} catch (error) {
  const message = `[migration] base injoignable (${error.code ?? error.message}).`;

  if (AT_STARTUP) {
    console.warn(
      `${message}\n` +
        '[migration] Le site démarre quand même : marées, météo et guides n’en dépendent pas.\n' +
        '[migration] Les comptes resteront fermés tant que la base ne répond pas.',
    );
    process.exit(0);
  }

  console.error(
    `${message}\n\n` +
      'Sur un hébergement mutualisé, vérifiez que l’application et la base sont bien sur\n' +
      'le même hôte : un accès distant demande une autorisation par adresse IP.',
  );
  process.exit(1);
}

console.log(`[migration] ${settings.user}@${settings.host}:${settings.port}/${settings.database}`);

/*
  Le registre est créé par le script lui-même : il ne peut pas être dans une
  migration, puisqu'il sert à savoir quelles migrations ont été appliquées.
*/
await connection.execute(`
  create table if not exists schema_migrations (
    filename   varchar(255) primary key,
    checksum   char(64) not null,
    applied_at datetime(3) not null default current_timestamp(3)
  ) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci
`);

const [rows] = await connection.execute('select filename, checksum from schema_migrations');
const applied = new Map(rows.map((row) => [row.filename, row.checksum]));

const dir = path.join(process.cwd(), 'db/migrations');
const files = readdirSync(dir)
  .filter((name) => name.endsWith('.sql'))
  .sort();

let count = 0;
let echec = false;

for (const file of files) {
  const sql = readFileSync(path.join(dir, file), 'utf8');
  const checksum = createHash('sha256').update(sql).digest('hex');
  const previous = applied.get(file);

  if (previous !== undefined) {
    if (previous !== checksum) {
      console.error(
        `\n[migration] ${file} a CHANGÉ depuis son application.\n\n` +
          'Modifier une migration déjà passée fait diverger les environnements en\n' +
          'silence : la base garde l’ancienne forme, le dépôt affiche la nouvelle.\n' +
          'Créez plutôt une NOUVELLE migration qui exprime le changement.',
      );
      echec = true;
      await terminerSurEchec(connection);
      break;
    }

    continue;
  }

  const statements = statementsOf(sql);
  process.stdout.write(`[migration] ${file} — ${statements.length} instructions… `);

  try {
    for (const statement of statements) await connection.execute(statement);
    await connection.execute(
      'insert into schema_migrations (filename, checksum) values (?, ?)',
      [file, checksum],
    );

    console.log('appliqué');
    count += 1;
  } catch (error) {
    console.log('ÉCHEC');
    console.error(`\n${error.sqlMessage ?? error.message}`);
    console.error(
      '\nLa migration n’est PAS enregistrée : elle sera retentée au prochain passage.',
    );
    echec = true;
    await terminerSurEchec(connection);
    break;
  }
}

/*
  Le compte rendu final ne doit jamais dire « à jour » après un échec : c'est
  précisément la ligne qu'on relit dans un journal de déploiement pour se
  rassurer.
*/
if (echec) {
  console.error(`[migration] INTERROMPUE après ${count} migration(s). Schéma incomplet.`);
} else {
  if (count === 0) console.log('[migration] schéma déjà à jour.');
  else console.log(`[migration] ${count} migration(s) appliquée(s).`);

  await connection.end();
}
