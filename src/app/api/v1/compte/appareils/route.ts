import { z } from 'zod';

import { enregistrerAppareil, retirerAppareil } from '@/lib/providers/mysql/appareils';
import {
  CORPS_ILLISIBLE,
  corpsJson,
  refus,
  saisieInvalide,
  succes,
} from '@/lib/api/reponse';
import { exigerPorteur } from '@/lib/api/garde';

export const dynamic = 'force-dynamic';

/**
 * Enregistrer — ou retirer — un appareil pour les notifications.
 *
 * ── Ce que l'application envoie, et rien de plus ─────────────────────────
 *
 * Un jeton, une plateforme, et un nom que la PERSONNE a écrit si elle en a
 * écrit un. Pas de modèle d'appareil, pas de version du système, pas
 * d'identifiant publicitaire : ils rendraient les notifications d'un cheveu
 * plus faciles à déboguer et transformeraient la table en profil.
 *
 * ── Le jeton n'est pas un secret, et il est quand même vérifié ───────────
 *
 * Un jeton de notification ne donne aucun accès au compte ; au pire il permet
 * à qui le connaît de recevoir les alertes destinées à un autre. Il est donc
 * attaché au compte AUTHENTIFIÉ de la requête, jamais à un identifiant fourni
 * dans le corps — c'est ce qui empêche d'inscrire son propre téléphone aux
 * alertes de quelqu'un d'autre.
 */
const appareilSchema = z.object({
  token: z
    .string({ required_error: 'Jeton de notification manquant.' })
    .trim()
    .min(8, 'Jeton de notification trop court.')
    .max(255, 'Jeton de notification trop long.'),
  platform: z.enum(['ios', 'android'], {
    errorMap: () => ({ message: 'Plateforme inconnue : attendu « ios » ou « android ».' }),
  }),
  /** Déclaratif : c'est la personne qui nomme son téléphone, jamais l'appareil. */
  label: z
    .union([z.string(), z.null()])
    .optional()
    .transform((valeur) => (valeur === undefined || valeur === null ? null : valeur.trim()))
    .refine((valeur) => valeur === null || valeur.length <= 60, {
      message: 'Nom d’appareil trop long (60 caractères au maximum).',
    })
    .transform((valeur) => (valeur === null || valeur.length === 0 ? null : valeur)),
});

export async function POST(requete: Request): Promise<Response> {
  const garde = await exigerPorteur(requete);
  if (!garde.ok) return garde.reponse;

  const corps = await corpsJson(requete);
  if (corps === null) return CORPS_ILLISIBLE();

  const analyse = appareilSchema.safeParse(corps);
  if (!analyse.success) return saisieInvalide(analyse.error);

  try {
    await enregistrerAppareil(garde.porteur.id, analyse.data);
  } catch (erreur) {
    console.error('[api] enregistrement d’appareil impossible', erreur);
    return refus(
      503,
      'indisponible',
      'L’enregistrement de cet appareil a échoué côté serveur. Les notifications n’arriveront pas tant qu’il n’a pas abouti : l’application réessaiera au prochain démarrage.',
    );
  }

  return succes({ registered: true });
}

/**
 * Retirer un appareil.
 *
 * Coupe les notifications sur CE téléphone sans toucher aux autres, ni au
 * compte. C'est ce que fait l'interrupteur « notifications » de l'écran
 * Compte : un réglage doit pouvoir s'annuler par le même geste qui l'a posé.
 */
export async function DELETE(requete: Request): Promise<Response> {
  const garde = await exigerPorteur(requete);
  if (!garde.ok) return garde.reponse;

  const corps = await corpsJson(requete);
  if (corps === null) return CORPS_ILLISIBLE();

  const analyse = appareilSchema.pick({ token: true }).safeParse(corps);
  if (!analyse.success) return saisieInvalide(analyse.error);

  try {
    await retirerAppareil(garde.porteur.id, analyse.data.token);
  } catch (erreur) {
    console.error('[api] retrait d’appareil impossible', erreur);
    return refus(503, 'indisponible', 'Le retrait de cet appareil a échoué. Réessayez dans un instant.');
  }

  return succes({ registered: false });
}
