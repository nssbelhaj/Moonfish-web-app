import { z } from 'zod';

import { majPreferences } from '@/lib/providers/mysql/comptes';
import { CORPS_ILLISIBLE, corpsJson, refus, saisieInvalide, succes } from '@/lib/api/reponse';
import { exigerPorteur } from '@/lib/api/garde';

export const dynamic = 'force-dynamic';

/**
 * Les préférences d'envoi.
 *
 * DEUX booléens, pas un réglage libre : ce qui n'est pas listé ici n'est pas
 * envoyé. Une liste fermée est ce qui permet à la page de confidentialité de
 * dire exactement ce qu'on envoie — une case « autres communications »
 * rendrait la phrase invérifiable.
 *
 * `notifyOutings` commandera aussi les notifications push, pas seulement le
 * courriel : c'est le même consentement, sur un autre canal. En redemander un
 * second pour la même chose serait du bruit.
 */
const preferencesSchema = z.object({
  notifyOutings: z.boolean(),
  notifyNews: z.boolean(),
});

export async function PUT(requete: Request): Promise<Response> {
  const garde = await exigerPorteur(requete);
  if (!garde.ok) return garde.reponse;

  const corps = await corpsJson(requete);
  if (corps === null) return CORPS_ILLISIBLE();

  const analyse = preferencesSchema.safeParse(corps);
  if (!analyse.success) return saisieInvalide(analyse.error);

  try {
    await majPreferences(garde.porteur.id, analyse.data);
  } catch (erreur) {
    console.error('[api] préférences non enregistrées', erreur);
    return refus(503, 'indisponible', 'Les préférences n’ont pas pu être enregistrées. Réessayez.');
  }

  return succes(analyse.data);
}
