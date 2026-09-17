import { spotSlugSchema } from '@/data/schemas';
import { contributions, spots } from '@/lib/providers';
import { INTROUVABLE, saisieInvalide, succes } from '@/lib/api/reponse';
import { contributionsEnJson } from '@/lib/api/serialisation';

/**
 * Les avis et les prises publiques d'un spot.
 *
 * ── Dynamique, contrairement aux deux autres routes de lecture ───────────
 *
 * Elle lit la base, et un avis publié doit se voir tout de suite. La page du
 * site, elle, est pré-rendue et révalidée à l'écriture ; ce mécanisme n'a pas
 * d'équivalent pour un client qui tire les données quand il veut. On paie
 * donc une lecture par appel — deux `select` bornés à une page, sur des
 * colonnes indexées.
 *
 * ── Les prises privées ne sortent pas de la base ─────────────────────────
 *
 * `forSpot` filtre `visibility = 'publique'` DANS la requête. Cette route n'a
 * donc aucun filtre à appliquer, et c'est voulu : ce qui ne quitte pas la
 * base ne peut pas fuir par une sérialisation distraite. Une prise est privée
 * par défaut ; publier est un geste, pas une conséquence.
 *
 * ── Les comptes fermés ne sont pas une erreur ────────────────────────────
 *
 * Sans base configurée, le dépôt rend des listes vides et `available` vaut
 * `false`. On répond 200 avec zéro avis plutôt qu'une erreur : un déploiement
 * sans comptes est un mode prévu, et l'application doit afficher le spot sans
 * rien de cassé.
 */
export const dynamic = 'force-dynamic';

export async function GET(
  _requete: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  // Le slug est borné avant d'atteindre le dépôt : il vient d'une URL, donc
  // d'un inconnu, et rien ne garantit qu'il ressemble à un slug.
  const analyse = spotSlugSchema.safeParse((await params).slug);
  if (!analyse.success) return saisieInvalide(analyse.error);
  const slug = analyse.data;

  const spot = await spots.findBySlug(slug);
  if (spot === null) return INTROUVABLE(`Le spot « ${slug} »`);

  const donnees = contributionsEnJson(await contributions.forSpot(slug));

  return succes({ ...donnees, accountsOpen: contributions.available });
}
