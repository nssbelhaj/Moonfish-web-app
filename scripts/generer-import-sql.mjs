#!/usr/bin/env node
/*
  Fabrique `db/import-manuel.sql` : le schéma complet en UN fichier, importable
  depuis phpMyAdmin quand on n'a pas de terminal sur l'hébergement.

    node scripts/generer-import-sql.mjs             (régénère)
    node scripts/generer-import-sql.mjs --verifier  (échoue si le fichier a vieilli)

  ─── Pourquoi ce fichier est GÉNÉRÉ et jamais écrit à la main ──────────────

  Il ne contient pas que des tables : il inscrit aussi, dans `schema_migrations`,
  le nom et l'EMPREINTE de chaque migration qu'il applique. Sans cela, le script
  de démarrage croirait les migrations jamais passées et les rejouerait.

  Or une empreinte recopiée à la main vieillit en silence. Le jour où une
  migration change, le fichier d'import inscrirait une empreinte périmée, et le
  déploiement suivant s'arrêterait sur « a CHANGÉ depuis son application » — un
  refus juste, déclenché par une cause fausse, au pire moment. D'où le
  `--verifier`, joué en intégration continue.
*/

import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const CHECK = process.argv.includes('--verifier');
const DIR = path.join(process.cwd(), 'db/migrations');
const TARGET = path.join(process.cwd(), 'db/import-manuel.sql');

const files = readdirSync(DIR)
  .filter((name) => name.endsWith('.sql'))
  .sort();

const parts = [
  `-- ═══════════════════════════════════════════════════════════════════════════
--  Luna Marea — schéma complet, prêt à importer
-- ═══════════════════════════════════════════════════════════════════════════
--
--  FICHIER GÉNÉRÉ. Ne le modifiez pas : « node scripts/generer-import-sql.mjs ».
--
--  ─── À quoi il sert, et quand il ne sert à rien ──────────────────────────
--
--  Il n'est utile que si vous n'avez PAS de terminal sur l'hébergement et
--  devez passer par phpMyAdmin. Sur un déploiement normal, il n'y a rien à
--  importer : \`prestart\` applique les migrations tout seul avant chaque
--  démarrage, et c'est le chemin à préférer.
--
--  ─── Import ──────────────────────────────────────────────────────────────
--
--  phpMyAdmin → votre base → Importer → ce fichier → Exécuter.
--  Choisissez bien la base AVANT : le fichier n'en crée ni n'en sélectionne
--  aucune, exprès. Un « create database » ici écraserait un choix déjà fait
--  dans l'interface, et sur un hébergement mutualisé le nom de la base est
--  imposé par le panneau, pas par nous.
--
--  Il est SANS DANGER sur une base déjà en service : tout est en
--  « create table if not exists », et l'inscription dans \`schema_migrations\`
--  est en « insert ignore ». Le rejouer ne détruit rien et ne perd rien.
--
--  ─── Ce que la dernière section fait, et pourquoi elle est indispensable ──
--
--  Elle inscrit chaque migration comme DÉJÀ APPLIQUÉE, avec son empreinte.
--  Sans elle, le premier démarrage de l'application les rejouerait toutes :
--  aujourd'hui sans dégât, mais la première migration qui ajoutera une colonne
--  échouerait alors en pleine mise en ligne.
--
--  ─── Après l'import ──────────────────────────────────────────────────────
--
--  Rien. Renseignez DATABASE_URL et démarrez : le site trouve son schéma en
--  place et le confirme au démarrage par « schéma déjà à jour ».

create table if not exists schema_migrations (
  filename   varchar(255) primary key,
  checksum   char(64) not null,
  applied_at datetime(3) not null default current_timestamp(3)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;
`,
];

const seeds = [];

for (const file of files) {
  const sql = readFileSync(path.join(DIR, file), 'utf8');
  const checksum = createHash('sha256').update(sql).digest('hex');

  parts.push(
    `\n-- ┌${'─'.repeat(72)}\n-- │ ${file}\n-- └${'─'.repeat(72)}\n\n${sql.trimEnd()}\n`,
  );
  seeds.push(`  ('${file}', '${checksum}')`);
}

parts.push(
  `\n-- ── Marquer ces migrations comme appliquées ───────────────────────────────
--
-- « insert ignore » : réimporter ce fichier ne fausse pas les dates déjà
-- enregistrées.

insert ignore into schema_migrations (filename, checksum) values
${seeds.join(',\n')};
`,
);

const content = parts.join('');

if (CHECK) {
  let current = '';
  try {
    current = readFileSync(TARGET, 'utf8');
  } catch {
    // Fichier absent : traité comme périmé.
  }

  if (current !== content) {
    console.error(
      'db/import-manuel.sql ne correspond plus aux migrations.\n\n' +
        'Il inscrit des empreintes : périmées, elles feraient échouer le PROCHAIN\n' +
        'déploiement sur « a CHANGÉ depuis son application » — un refus juste pour\n' +
        'une cause fausse.\n\n' +
        'Régénérez-le :  node scripts/generer-import-sql.mjs',
    );
    process.exit(1);
  }

  console.log('db/import-manuel.sql est à jour.');
  process.exit(0);
}

writeFileSync(TARGET, content);
console.log(`db/import-manuel.sql écrit — ${files.length} migration(s).`);
