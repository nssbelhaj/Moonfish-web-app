import { succes } from '@/lib/api/reponse';
import { fermerSessionPorteur, jetonDe } from '@/lib/api/porteur';

export const dynamic = 'force-dynamic';

/**
 * Déconnexion : la session disparaît de la base.
 *
 * ── Elle répond 200 même sans jeton valide ───────────────────────────────
 *
 * Se déconnecter est le seul geste qu'on doit toujours pouvoir faire aboutir.
 * Répondre 401 à qui présente un jeton déjà expiré laisserait l'application
 * devant un échec qu'elle ne peut pas résoudre — elle n'a rien de mieux à
 * envoyer — et la tentation serait alors de garder le jeton « au cas où ».
 * Le résultat voulu est atteint dans les deux cas : plus de session.
 *
 * L'application efface son jeton du trousseau dès qu'elle reçoit cette
 * réponse, sans attendre.
 */
export async function DELETE(requete: Request): Promise<Response> {
  const jeton = jetonDe(requete);

  if (jeton !== null) {
    try {
      await fermerSessionPorteur(jeton);
    } catch (erreur) {
      // Une base qui ne répond pas ne doit pas empêcher l'application d'oublier
      // le jeton de son côté. La ligne restera jusqu'à son expiration, puis la
      // purge quotidienne de `/api/entretien` la ramassera.
      console.error('[api] fermeture de session impossible', erreur);
    }
  }

  return succes({ closed: true });
}
