#!/usr/bin/env node
/*
  Applique les migrations SQL à la base configurée.

    node scripts/migrer-mysql.mjs

  Lit `DATABASE_URL` (ou MYSQL_HOST/USER/PASSWORD/DATABASE) depuis
  l'environnement ou `.env.local`. Les migrations sont idempotentes — tout est
  en `create table if not exists` — donc relancer ne casse rien.

  Pourquoi un script plutôt qu'un copier-coller dans phpMyAdmin : le pilote
  n'exécute qu'une instruction par appel, et découper un fichier SQL à la main
  est exactement le genre de tâche où l'on oublie la dernière table.
*/

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import mysql from 'mysql2/promise';

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
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: parsed.port ? Number(parsed.port) : 3306,
      user: decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password),
      database: parsed.pathname.replace(/^\//, ''),
    };
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

const settings = config();

if (!settings) {
  console.error(
    'Aucune base configurée.\n' +
      'Renseignez DATABASE_URL (ou MYSQL_HOST / MYSQL_USER / MYSQL_PASSWORD / MYSQL_DATABASE)\n' +
      'dans .env.local — voir .env.example.',
  );
  process.exit(2);
}

console.log(`Base : ${settings.user}@${settings.host}:${settings.port}/${settings.database}\n`);

const dir = path.join(process.cwd(), 'db/migrations');
const files = readdirSync(dir).filter((name) => name.endsWith('.sql')).sort();

let connection;
try {
  connection = await mysql.createConnection({ ...settings, multipleStatements: false });
} catch (error) {
  console.error(`Connexion impossible : ${error.message}`);
  console.error(
    '\nSur un hébergement mutualisé, vérifiez que l’application et la base sont bien sur\n' +
      'le même hôte : un accès distant demande une autorisation par adresse IP.',
  );
  process.exit(1);
}

for (const file of files) {
  const sql = readFileSync(path.join(dir, file), 'utf8');

  // Les commentaires sont retirés AVANT le découpage : un « ; » dans une
  // phrase française couperait sinon une instruction en deux.
  const statements = sql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);

  process.stdout.write(`${file} — ${statements.length} instructions… `);

  try {
    for (const statement of statements) await connection.execute(statement);
    console.log('appliqué');
  } catch (error) {
    console.log('ÉCHEC');
    console.error(`\n${error.sqlMessage ?? error.message}`);
    await connection.end();
    process.exit(1);
  }
}

const [tables] = await connection.execute('show tables');
console.log(`\n${tables.length} tables en place :`);
for (const row of tables) console.log(`  · ${Object.values(row)[0]}`);

await connection.end();
