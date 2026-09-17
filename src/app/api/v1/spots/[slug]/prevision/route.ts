import { getSpotForecast } from '@/lib/forecast';
import { spotSlugSchema } from '@/data/schemas';
import { spots } from '@/lib/providers';
import { INTROUVABLE, saisieInvalide, succes } from '@/lib/api/reponse';
import { previsionEnJson } from '@/lib/api/serialisation';

/**
 * La prévision complète d'un spot : sept jours, douze créneaux par jour.
 *
 * ── Elle ne recalcule rien de plus que la page du site ───────────────────
 *
 * `getSpotForecast` est la MÊME fonction que celle des pages de spot. Il n'y
 * a donc qu'une implémentation du score, une seule évaluation de la règle de
 * sécurité, et aucun moyen pour l'application et le site de diverger — ce qui
 * est le motif entier de cette API. Si un jour on ajustait un seuil ici, le
 * site le prendrait aussi, parce que c'est le même code.
 *
 * ── Le cache d'une heure n'est pas une optimisation, c'est le budget ─────
 *
 * `referenceNow()` arrondit l'instant à l'heure, et les pages de spot sont
 * déjà en ISR à 3 600 s. Sans cache ici, chaque ouverture de l'application
 * relancerait l'assemblage complet — dont la recherche des levers de Lune,
 * la partie coûteuse — et, pire, sortirait du cache de `fetch` des
 * fournisseurs. L'offre gratuite de Stormglass est de dix appels par JOUR :
 * une route de prévision non cachée l'épuiserait avant le petit-déjeuner.
 */
export const revalidate = 3600;

/**
 * ═══ CE QUE LE BUILD A RÉVÉLÉ, ET QUE `revalidate` SEUL NE FAISAIT PAS ═══
 *
 * `export const revalidate = 3600` ne suffit PAS sur un segment dynamique.
 * Sans `generateStaticParams`, le tableau des routes annonçait « ƒ » —
 * rendue à la demande, à chaque appel — alors que la constante juste au-dessus
 * laissait croire le contraire. Le fichier se relisait comme une route cachée
 * et n'en était pas une.
 *
 * La conséquence n'aurait pas été visible à l'écran : les réponses auraient
 * été justes. Elle se serait vue sur la facture, ou plutôt sur le quota — dix
 * appels Stormglass par jour, épuisés par une poignée d'ouvertures de
 * l'application, puis quarante-deux spots retombés en marée simulée pour la
 * journée. Exactement la panne silencieuse que `TIDE_REAL_SPOTS` existe pour
 * éviter, réintroduite par une autre porte.
 *
 * Les quarante-deux spots sont donc pré-rendus au build, comme les pages du
 * site. Un slug absent de cette liste reste servi à la demande : c'est ce qui
 * permet d'ajouter un spot sans reconstruire, et il finit de toute façon en
 * 404 s'il n'existe pas.
 */
export async function generateStaticParams(): Promise<{ slug: string }[]> {
  const catalogue = await spots.list();
  return catalogue.map((spot) => ({ slug: spot.slug }));
}

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

  return succes(previsionEnJson(await getSpotForecast(spot)));
}
