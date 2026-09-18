import { z } from 'zod';

import { contributions } from '@/lib/providers';
import { refusDeContribution, saisieInvalide, succes } from '@/lib/api/reponse';
import { exigerPorteur } from '@/lib/api/garde';

export const dynamic = 'force-dynamic';

/**
 * Annuler une sortie programmée.
 *
 * Aucune page à rafraîchir : une sortie n'est vue de personne d'autre. C'est
 * la même raison qui lui évite d'exiger un nom affiché.
 *
 * Conséquence utile : annuler une sortie annule aussi son alerte, puisque la
 * tâche d'entretien ne ramasse que les lignes existantes. Il n'y a pas de
 * second geste à faire, ni d'alerte orpheline à nettoyer.
 */
export async function DELETE(
  requete: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const garde = await exigerPorteur(requete);
  if (!garde.ok) return garde.reponse;

  const id = z.string().uuid('Identifiant de sortie invalide.').safeParse((await params).id);
  if (!id.success) return saisieInvalide(id.error);

  const resultat = await contributions.deleteOuting(id.data, garde.porteur.id);
  if (!resultat.ok) return refusDeContribution(resultat);

  return succes({ id: id.data, deleted: true });
}
