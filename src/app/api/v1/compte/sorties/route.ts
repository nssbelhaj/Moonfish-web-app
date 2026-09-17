import { outingInputSchema } from '@/data/schemas';
import { contributions } from '@/lib/providers';
import {
  CORPS_ILLISIBLE,
  corpsJson,
  refusDeContribution,
  saisieInvalide,
  succes,
} from '@/lib/api/reponse';
import { exigerPorteur } from '@/lib/api/garde';

export const dynamic = 'force-dynamic';

/**
 * Programmer une sortie.
 *
 * ── Aucun nom affiché exigé ──────────────────────────────────────────────
 *
 * Une sortie n'est vue de personne d'autre. Elle passe donc par
 * `exigerPorteur` et non `exigerAuteur` : demander un nom public pour une
 * note privée serait une formalité sans objet.
 *
 * ── Ce que `alert` déclenche, et quand ───────────────────────────────────
 *
 * `/api/entretien` ramasse chaque jour les sorties prévues dans les 36
 * heures — pas 24 : la tâche tourne une fois par jour à une heure qu'on ne
 * choisit pas finement, et avec 24 h une sortie à 8 h et une tâche à 9 h la
 * veille ne se verraient jamais. L'alerte partira par courriel, et bientôt
 * aussi en notification sur les appareils enregistrés.
 */
export async function POST(requete: Request): Promise<Response> {
  const garde = await exigerPorteur(requete);
  if (!garde.ok) return garde.reponse;

  const corps = await corpsJson(requete);
  if (corps === null) return CORPS_ILLISIBLE();

  const analyse = outingInputSchema.safeParse(corps);
  if (!analyse.success) return saisieInvalide(analyse.error);

  const resultat = await contributions.addOuting(garde.porteur.id, analyse.data);
  if (!resultat.ok) return refusDeContribution(resultat);

  return succes({ outing: resultat.data });
}
