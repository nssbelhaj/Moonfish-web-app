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
    · base injoignable         → AVERTISSEMENT, et on démarre quand même. Une
      panne passagère de base ne doit pas empêcher de servir les marées, la
      météo et les guides, qui n'en dépendent pas ;
    · migration en échec       → ARRÊT. Faire tourner du code contre un schéma
      à moitié migré corrompt des données en silence ; mieux vaut que le
      déploiement échoue et que la version précédente reste en ligne.

  En manuel, l'injoignabilité est une erreur : on a demandé une migration.
*/

import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import mysql from 'mysql2/promise';

const AT_STARTUP = process.argv.includes('--au-demarrage');

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

function config() {
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
      return null;
    }
  }

  const { MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE, MYSQL_PORT } = process.env;
  if (!MYSQL_HOST || !MYSQL_USER || !MYSQL_DATABASE) return null;

  return {
    host: MYSQL_HOST,
    port: Number(MYSQL_PORT ?? 3306),
    user: MYSQL_USER,
    password: MYSQL_PASSWORD ?? '',
    database: MYSQL_DATABASE,
  };
}

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

const settings = config();

if (!settings) {
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
      await connection.end();
      process.exit(1);
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
      '\nLa migration n’est PAS enregistrée : elle sera retentée au prochain passage.\n' +
        'Rien ne doit tourner contre un schéma à moitié migré.',
    );
    await connection.end();
    process.exit(1);
  }
}

if (count === 0) console.log('[migration] schéma déjà à jour.');
else console.log(`[migration] ${count} migration(s) appliquée(s).`);

await connection.end();
