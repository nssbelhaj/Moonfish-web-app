import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { PHOTO_BUCKET, TABLE_COLUMNS } from '../database.types';

/**
 * La migration SQL est la vérité ; les types TypeScript en sont le miroir.
 *
 * Rien n'oblige les deux à rester d'accord — pas de génération automatique ici,
 * puisqu'elle demanderait un accès au projet Supabase. Ces tests remplacent
 * cette garantie : ils lisent le SQL et le comparent aux types. Une colonne
 * ajoutée d'un seul côté fait échouer la suite, au lieu de produire une erreur
 * PostgREST en production, six semaines plus tard, sur une colonne inconnue.
 */
const SQL = readFileSync(
  path.join(process.cwd(), 'supabase/migrations/0001_comptes_et_contributions.sql'),
  'utf8',
);

/** Colonnes déclarées dans un `create table`, dans l'ordre du fichier. */
function sqlColumns(table: string): string[] {
  const start = SQL.indexOf(`create table if not exists public.${table} (`);
  expect(start, `table absente du SQL : ${table}`).toBeGreaterThan(-1);

  const body = SQL.slice(SQL.indexOf('(', start) + 1, SQL.indexOf('\n);', start));

  return body
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('--'))
    // Écarte les contraintes de table (`unique (…)`, `check (…)`, `primary key (…)`)
    // qui ne sont pas des colonnes.
    .filter((line) => !/^(unique|check|primary key|foreign key|constraint)\b/i.test(line))
    .map((line) => line.split(/\s+/)[0] as string)
    .filter((name) => /^[a-z_]+$/.test(name));
}

describe('le SQL et les types ne divergent pas', () => {
  for (const table of Object.keys(TABLE_COLUMNS) as (keyof typeof TABLE_COLUMNS)[]) {
    it(`décrit les mêmes colonnes pour ${table}`, () => {
      const inTypes = Object.keys(TABLE_COLUMNS[table]).sort();
      const inSql = sqlColumns(table).sort();
      expect(inSql).toStrictEqual(inTypes);
    });
  }
});

describe('sécurité au niveau des lignes', () => {
  const TABLES = ['waitlist', 'profiles', 'spot_reviews', 'catches'];

  it('active RLS sur TOUTES les tables', () => {
    // Une table sans RLS est lisible et modifiable par quiconque possède la clé
    // publique — laquelle est, par définition, dans le paquet JavaScript envoyé
    // à chaque visiteur. C'est le seul oubli de ce fichier qui exposerait tout.
    for (const table of TABLES) {
      expect(SQL, `RLS non activée sur ${table}`).toContain(
        `alter table public.${table} enable row level security;`,
      );
    }
  });

  it('n’ouvre l’écriture qu’à son propre identifiant', () => {
    // Chaque politique d'écriture doit comparer `auth.uid()` à la ligne. Une
    // politique `with check (true)` sur une table d'utilisateurs laisserait
    // écrire au nom de n'importe qui.
    const writePolicies = SQL.match(/create policy "[^"]+"\s+on public\.\w+ for (insert|update|delete)[\s\S]*?;/g) ?? [];
    expect(writePolicies.length).toBeGreaterThan(6);

    for (const policy of writePolicies) {
      const table = /on public\.(\w+)/.exec(policy)?.[1];
      // La liste d'attente est la seule exception assumée : c'est un formulaire
      // public, et personne — pas même son auteur — ne peut la relire.
      if (table === 'waitlist') continue;
      expect(policy, `politique d’écriture sans contrôle d’identité : ${policy.slice(0, 60)}`).toContain(
        'auth.uid()',
      );
    }
  });

  it('ne donne AUCUN droit de lecture sur la liste d’attente', () => {
    // Une politique de SELECT sur `waitlist` rendrait toutes les adresses
    // aspirables avec la clé publique.
    const selects = SQL.match(/create policy "[^"]+"\s+on public\.waitlist for select/g) ?? [];
    expect(selects).toStrictEqual([]);
  });

  it('cloisonne les photos par dossier utilisateur', () => {
    expect(SQL).toContain(`insert into storage.buckets (id, name, public)`);
    expect(SQL).toContain(`'${PHOTO_BUCKET}'`);
    // Le premier segment du chemin doit être l'identifiant : sans cette
    // condition, n'importe qui pourrait écraser la photo d'un autre.
    expect(SQL).toContain('(storage.foldername(name))[1] = auth.uid()::text');
  });

  it('efface les contributions avec le compte', () => {
    // Le droit à l'effacement, écrit dans le schéma plutôt que confié à du code
    // applicatif qu'on pourrait oublier d'appeler.
    const cascades = SQL.match(/references auth\.users \(id\) on delete cascade/g) ?? [];
    expect(cascades.length).toBe(3);
  });
});
