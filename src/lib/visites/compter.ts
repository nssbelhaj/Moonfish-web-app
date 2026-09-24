import { execute, query } from '@/lib/db/mysql';

/**
 * Le compteur de pages vues : par jour, par chemin, et rien d'autre.
 *
 * ─── Pourquoi pas Google Analytics ────────────────────────────────────────
 *
 * Le site promet « aucune requête vers un tiers depuis votre navigateur »,
 * n'a pas de bandeau de consentement, et un test le fait respecter. Une
 * mesure d'audience tierce exigerait le bandeau, un script étranger, et un
 * identifiant par visiteur — pour apprendre des choses qu'on ne veut pas
 * savoir. Ce qu'on veut savoir tient en une question : quelles pages vivent.
 *
 * ─── Ce que le compteur refuse de connaître ───────────────────────────────
 *
 * Ni adresse IP, ni agent utilisateur, ni identifiant, ni provenance. La
 * route ne lit pas les en-têtes qui les portent — un test le vérifie. On ne
 * peut donc pas distinguer dix visites d'une seule personne de dix personnes,
 * et c'est accepté : c'est le prix d'une mesure qui ne concerne personne.
 *
 * Le signal Global Privacy Control (et son ancêtre Do Not Track) est
 * respecté des deux côtés : le navigateur n'envoie rien, et le serveur ne
 * compte pas ce qui arriverait quand même.
 */

/** Longueur de colonne. Aucun chemin du site n'approche cette taille. */
const CHEMIN_MAX = 200;

/**
 * Le chemin tel qu'il sera compté, ou `null` s'il ne mérite pas de l'être.
 *
 * Les paramètres et l'ancre sont retirés : `/compte?next=/spots/x` compte
 * pour `/compte`, et un jeton de réinitialisation n'atteint jamais la table.
 * Les chemins techniques (`/api/…`, `/_next/…`) ne sont pas des pages.
 */
export function cheminComptable(brut: unknown): string | null {
  if (typeof brut !== 'string') return null;
  const sansAncre = brut.split('#')[0] ?? '';
  const sansParametres = sansAncre.split('?')[0] ?? '';
  const chemin = sansParametres.trim();

  if (!chemin.startsWith('/')) return null;
  if (chemin.startsWith('//')) return null;
  if (chemin.length > CHEMIN_MAX) return null;
  if (/^\/(api|_next)\b/.test(chemin)) return null;
  if (/[\s<>"'\\]/.test(chemin)) return null;
  // Une barre finale et sa version sans sont la même page.
  return chemin.length > 1 && chemin.endsWith('/') ? chemin.slice(0, -1) : chemin;
}

/** `AAAA-MM-JJ` en UTC : la journée du compteur, la même pour tout le monde. */
export function jourDe(instant: Date): string {
  return instant.toISOString().slice(0, 10);
}

export async function enregistrerVisite(chemin: string, instant: Date = new Date()): Promise<void> {
  await execute(
    'insert into visites (jour, chemin, n) values (?, ?, 1) on duplicate key update n = n + 1',
    [jourDe(instant), chemin],
  );
}

export interface ResumeVisites {
  jours: number;
  total: number;
  /** Les pages les plus vues sur la période, avec leur compte. */
  pages: { chemin: string; n: number }[];
}

export async function resumeVisites(jours = 7, combien = 8, instant: Date = new Date()): Promise<ResumeVisites> {
  const depuis = jourDe(new Date(instant.getTime() - (jours - 1) * 86_400_000));
  const lignes = await query<{ chemin: string; n: number | string }>(
    `select chemin, sum(n) as n from visites where jour >= ? group by chemin order by n desc limit ?`,
    [depuis, combien],
  );
  const [totalLigne] = await query<{ total: number | string | null }>(
    'select sum(n) as total from visites where jour >= ?',
    [depuis],
  );
  return {
    jours,
    total: Number(totalLigne?.total ?? 0),
    pages: lignes.map((ligne) => ({ chemin: ligne.chemin, n: Number(ligne.n) })),
  };
}

/** Treize mois : de quoi comparer un mois au même mois de l'année d'avant. */
export const RETENTION_VISITES_JOURS = 13 * 31;

export async function purgerVisites(instant: Date = new Date()): Promise<number> {
  const limite = jourDe(new Date(instant.getTime() - RETENTION_VISITES_JOURS * 86_400_000));
  return execute('delete from visites where jour < ?', [limite]);
}
