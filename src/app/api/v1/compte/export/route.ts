import { contributions } from '@/lib/providers';
import { refusDeContribution, succes } from '@/lib/api/reponse';
import { exigerLecteur } from '@/lib/api/garde';

export const dynamic = 'force-dynamic';

/**
 * Droit d'accès et de portabilité : tout ce que nous détenons, en une fois.
 *
 * ── Pourquoi cette route existe en plus de `GET /compte` ─────────────────
 *
 * `/compte` sert l'écran : profil, favoris, sorties, carnet — ce qui
 * s'affiche. L'export sert le DROIT : il porte aussi ce qui ne s'affiche
 * nulle part, à commencer par les appareils enregistrés pour les
 * notifications. Un export limité à ce que l'interface montre serait un export
 * incomplet, et personne ne pourrait s'en apercevoir.
 *
 * Aucun budget d'appel : exercer un droit n'a pas à être rationné, et la
 * lecture est bornée aux lignes d'une seule personne.
 */
export async function GET(requete: Request): Promise<Response> {
  const garde = await exigerLecteur(requete);
  if (!garde.ok) return garde.reponse;

  const resultat = await contributions.exportAccount(garde.porteur.id, garde.porteur.email);
  if (!resultat.ok) return refusDeContribution(resultat);

  return succes(resultat.data);
}
