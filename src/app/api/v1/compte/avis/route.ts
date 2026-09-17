import { spotReviewInputSchema } from '@/data/schemas';
import { contributions } from '@/lib/providers';
import {
  CORPS_ILLISIBLE,
  corpsJson,
  refusDeContribution,
  saisieInvalide,
  succes,
} from '@/lib/api/reponse';
import { exigerAuteur } from '@/lib/api/garde';

export const dynamic = 'force-dynamic';

/**
 * Publier ou remplacer son avis sur un spot.
 *
 * ── Zod passe DEUX fois, et c'est voulu ──────────────────────────────────
 *
 * Ici, puis à l'entrée du dépôt, qui ne fait confiance à personne. C'est ce
 * qui impose que les schémas d'entrée soient IDEMPOTENTS : la sortie du
 * premier passage doit être une entrée valable pour le second. Ce n'était pas
 * le cas au début du projet — le premier passage transformait un commentaire
 * vide en `null` et le second refusait `null` —, si bien que tout avis sans
 * commentaire était rejeté en production avec « saisie invalide ». Valider ici
 * n'est donc pas redondant : c'est ce qui rend le message d'erreur utile,
 * puisqu'il désigne le champ fautif.
 */
export async function POST(requete: Request): Promise<Response> {
  const garde = await exigerAuteur(requete);
  if (!garde.ok) return garde.reponse;

  const corps = await corpsJson(requete);
  if (corps === null) return CORPS_ILLISIBLE();

  const analyse = spotReviewInputSchema.safeParse(corps);
  if (!analyse.success) return saisieInvalide(analyse.error);

  const resultat = await contributions.saveReview(analyse.data, garde.auteur);
  if (!resultat.ok) return refusDeContribution(resultat);

  return succes({ review: resultat.data });
}
