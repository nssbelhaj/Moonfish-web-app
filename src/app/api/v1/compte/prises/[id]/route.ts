import { z } from 'zod';

import { visibilitySchema } from '@/data/schemas';
import { contributions, spots } from '@/lib/providers';
import { spotPath } from '@/lib/routes';
import { revalidatePath } from 'next/cache';
import {
  CORPS_ILLISIBLE,
  corpsJson,
  refusDeContribution,
  saisieInvalide,
  succes,
} from '@/lib/api/reponse';
import { exigerPorteur } from '@/lib/api/garde';

export const dynamic = 'force-dynamic';

const identifiantSchema = z.string().uuid('Identifiant de prise invalide.');

/**
 * Publier une prise, ou la reprendre.
 *
 * ── Le propriétaire est exigé par la SIGNATURE, pas vérifié ici ──────────
 *
 * `setCatchVisibility(id, userId, visibilite)` : le compilateur refuse
 * l'appel sans propriétaire, et la requête filtre sur `user_id = ?`. C'est ce
 * qui remplace, en MySQL, la politique que PostgreSQL appliquait lui-même —
 * et sans elle, quiconque connaîtrait un identifiant pourrait publier la
 * prise d'un autre.
 *
 * ── La page du spot est rafraîchie ───────────────────────────────────────
 *
 * Elle est pré-rendue une heure. Sans révalidation, une prise publiée depuis
 * le téléphone n'apparaîtrait sur le site qu'au bout d'une heure, et une
 * prise reprise y resterait visible aussi longtemps. Le second cas est le
 * grave : reprendre, c'est retirer de la vue, et un retrait qui se voit
 * encore n'est pas un retrait.
 */
export async function PUT(
  requete: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const garde = await exigerPorteur(requete);
  if (!garde.ok) return garde.reponse;

  const id = identifiantSchema.safeParse((await params).id);
  if (!id.success) return saisieInvalide(id.error);

  const corps = await corpsJson(requete);
  if (corps === null) return CORPS_ILLISIBLE();

  const analyse = z.object({ visibility: visibilitySchema }).safeParse(corps);
  if (!analyse.success) return saisieInvalide(analyse.error);

  // Le slug est relevé AVANT : après une modification on saurait encore, mais
  // la symétrie avec la suppression — où on ne saurait plus — vaut mieux que
  // deux chemins qui se ressemblent sans se comporter pareil.
  const mienne = (await contributions.listForUser(garde.porteur.id)).catches.find(
    (prise) => prise.id === id.data,
  );

  const resultat = await contributions.setCatchVisibility(
    id.data,
    garde.porteur.id,
    analyse.data.visibility,
  );
  if (!resultat.ok) return refusDeContribution(resultat);

  await rafraichirSpot(mienne?.spotSlug);

  return succes({ id: id.data, visibility: analyse.data.visibility });
}

/**
 * Supprimer une prise.
 *
 * Le spot est relevé AVANT la suppression : après, la ligne n'existe plus et
 * on ne saurait plus quelle page rafraîchir. C'est exactement le défaut qui
 * avait laissé un avis affiché une heure après l'effacement d'un compte.
 */
export async function DELETE(
  requete: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const garde = await exigerPorteur(requete);
  if (!garde.ok) return garde.reponse;

  const id = identifiantSchema.safeParse((await params).id);
  if (!id.success) return saisieInvalide(id.error);

  const mienne = (await contributions.listForUser(garde.porteur.id)).catches.find(
    (prise) => prise.id === id.data,
  );

  const resultat = await contributions.deleteCatch(id.data, garde.porteur.id);
  if (!resultat.ok) return refusDeContribution(resultat);

  await rafraichirSpot(mienne?.spotSlug);

  return succes({ id: id.data, deleted: true });
}

async function rafraichirSpot(slug: string | undefined): Promise<void> {
  if (slug === undefined) return;
  const spot = await spots.findBySlug(slug);
  if (spot !== null) revalidatePath(`${spotPath(spot)}/especes`);
}
