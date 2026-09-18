import { z } from 'zod';

import { displayNameSchema } from '@/data/schemas';
import { profilSchema } from '@/data/schemas-compte';
import { contributions } from '@/lib/providers';
import { majProfil } from '@/lib/providers/mysql/comptes';
import {
  CORPS_ILLISIBLE,
  corpsJson,
  refus,
  refusDeContribution,
  saisieInvalide,
  succes,
} from '@/lib/api/reponse';
import { exigerPorteur } from '@/lib/api/garde';

export const dynamic = 'force-dynamic';

/**
 * Le profil : nom affiché et informations déclaratives.
 *
 * ── Le nom affiché est traité à part, et ce n'est pas un caprice ─────────
 *
 * C'est le SEUL champ public : il signe les avis et les prises publiées. Les
 * autres — ville, pays, présentation — ne sortent nulle part aujourd'hui.
 * `renameProfile` existe donc séparément de `majProfil`, et le renommage
 * passe par lui : il applique ses propres bornes, et le jour où renommer
 * demandera de rafraîchir les pages où le nom apparaît, il n'y aura qu'un
 * endroit à changer.
 *
 * Tout est facultatif sauf le nom affiché. Un profil à moitié rempli est un
 * profil normal ; exiger une ville pour enregistrer une présentation serait
 * une formalité sans objet.
 */
const entreeSchema = z.object({
  displayName: displayNameSchema,
  profil: profilSchema.partial().optional(),
});

export async function PUT(requete: Request): Promise<Response> {
  const garde = await exigerPorteur(requete);
  if (!garde.ok) return garde.reponse;

  const corps = await corpsJson(requete);
  if (corps === null) return CORPS_ILLISIBLE();

  const analyse = entreeSchema.safeParse(corps);
  if (!analyse.success) return saisieInvalide(analyse.error);

  const renomme = await contributions.renameProfile(garde.porteur.id, analyse.data.displayName);
  if (!renomme.ok) return refusDeContribution(renomme);

  if (analyse.data.profil !== undefined) {
    const p = analyse.data.profil;
    try {
      await majProfil(garde.porteur.id, {
        firstName: p.firstName ?? null,
        lastName: p.lastName ?? null,
        city: p.city ?? null,
        country: p.country ?? null,
        bio: p.bio ?? null,
      });
    } catch (erreur) {
      console.error('[api] profil non enregistré', erreur);
      return refus(
        503,
        'indisponible',
        'Le nom affiché a été enregistré, mais pas le reste du profil. Réessayez dans un instant.',
      );
    }
  }

  return succes({ profile: renomme.data });
}
