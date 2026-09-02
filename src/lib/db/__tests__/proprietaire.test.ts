import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * ═══ CE FICHIER REMPLACE LA SÉCURITÉ AU NIVEAU DES LIGNES ═══
 *
 * Sur PostgreSQL, une politique déclarée dans le schéma refusait toute
 * écriture au nom d'autrui : le filtre vivait dans le moteur, et l'oublier
 * dans le code n'avait aucune conséquence. MySQL n'a pas d'équivalent.
 *
 * La garantie est donc devenue conventionnelle. Une convention que rien ne
 * vérifie ne vaut rien : ces tests sont ce qui lui donne du poids. Ils lisent
 * le SQL du dépôt et refusent trois choses.
 */

const ROOT = process.cwd();

/** Les seuls endroits où du SQL a le droit d'exister. */
const SQL_ALLOWED = [
  'src/lib/db/mysql.ts',
  'src/lib/providers/mysql',
  'src/lib/auth/mysql-adapter.ts',
];

/** Tables dont chaque ligne appartient à quelqu'un. */
const OWNED_TABLES = ['spot_reviews', 'catches', 'profiles'];

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return sources(full);
    return /\.tsx?$/.test(full) ? [full] : [];
  });
}

const FILES = sources(path.join(ROOT, 'src')).filter((file) => !file.includes('__tests__'));

function read(file: string): string {
  return readFileSync(file, 'utf8');
}

function isAllowed(file: string): boolean {
  const relative = path.relative(ROOT, file);
  return SQL_ALLOWED.some((allowed) => relative === allowed || relative.startsWith(`${allowed}/`));
}

/** Instructions SQL d'un fichier, ramenées sur une ligne. */
function statements(source: string): string[] {
  const found: string[] = [];
  const pattern = /(select|insert|update|delete)\s[\s\S]{0,600}?(?=['"`]\s*,|['"`]\s*\)|['"`];|`\s*,|`\s*\))/gi;

  for (const match of source.matchAll(pattern)) {
    found.push(match[0].replace(/\s+/g, ' ').trim());
  }

  return found;
}

describe('discipline SQL', () => {
  it('ne laisse aucune requête hors des modules autorisés', () => {
    // Une requête écrite dans une page ou un composant échapperait à toutes
    // les règles ci-dessous, et personne ne la relirait avec les mêmes yeux.
    const offenders: string[] = [];

    for (const file of FILES) {
      if (isAllowed(file)) continue;

      const source = read(file);
      if (/\b(from|into)\s+(spot_reviews|catches|profiles|waitlist|users|sessions)\b/i.test(source)) {
        offenders.push(path.relative(ROOT, file));
      }
    }

    expect(offenders, `SQL hors des modules autorisés : ${offenders.join(', ')}`).toStrictEqual([]);
  });

  it('exige `user_id = ?` sur toute modification d’une ligne appartenant à quelqu’un', () => {
    // ═══ LA règle ═══
    // C'est elle qui remplace la politique appliquée par PostgreSQL. Une
    // suppression écrite « where id = ? » effacerait la ligne de n'importe qui
    // connaissant un identifiant.
    const offenders: string[] = [];

    for (const file of FILES.filter(isAllowed)) {
      for (const statement of statements(read(file))) {
        const mutating = /^(update|delete)\b/i.test(statement);
        if (!mutating) continue;

        const table = OWNED_TABLES.find((name) =>
          new RegExp(`\\b(from|update)\\s+${name}\\b`, 'i').test(statement),
        );
        if (!table) continue;

        // `profiles` se filtre sur sa propre clé primaire, qui EST
        // l'identifiant de l'utilisateur.
        const predicate = table === 'profiles' ? /user_id\s*=\s*\?/i : /user_id\s*=\s*\?/i;

        if (!predicate.test(statement)) {
          offenders.push(`${path.relative(ROOT, file)} → ${statement.slice(0, 90)}`);
        }
      }
    }

    expect(
      offenders,
      `modification sans contrôle de propriétaire :\n${offenders.join('\n')}`,
    ).toStrictEqual([]);
  });

  it('n’ouvre aucun chemin de lecture sur la liste d’attente', () => {
    // Sur PostgreSQL, aucune politique de lecture n'existait : les adresses
    // étaient inaspirables même avec la clé publique. Ici, la protection est
    // qu'aucun `select` n'est écrit — et c'est ce test qui le garantit.
    const offenders: string[] = [];

    for (const file of FILES) {
      for (const statement of statements(read(file))) {
        if (/^select\b/i.test(statement) && /\bfrom\s+waitlist\b/i.test(statement)) {
          offenders.push(path.relative(ROOT, file));
        }
      }
    }

    expect(offenders, `lecture de la liste d’attente : ${offenders.join(', ')}`).toStrictEqual([]);
  });

  it('n’interpole jamais une valeur dans une requête', () => {
    // Les seules interpolations tolérées sont des NOMS DE COLONNES construits
    // à partir de littéraux du code — jamais de données. Toute autre
    // interpolation dans une chaîne SQL est une injection en puissance.
    const offenders: string[] = [];

    for (const file of FILES.filter(isAllowed)) {
      const source = read(file);

      for (const match of source.matchAll(/`[^`]*\b(select|insert|update|delete)\b[^`]*`/gi)) {
        const sql = match[0];
        for (const interpolation of sql.matchAll(/\$\{([^}]+)\}/g)) {
          const expression = (interpolation[1] ?? '').trim();
          // `sets.join(', ')` construit une liste de « colonne = ? » à partir
          // de littéraux : c'est le seul motif admis, et il est nommé.
          if (/^sets\.join\(/.test(expression)) continue;
          offenders.push(`${path.relative(ROOT, file)} → \${${expression}}`);
        }
      }
    }

    expect(offenders, `interpolation dans du SQL :\n${offenders.join('\n')}`).toStrictEqual([]);
  });
});
