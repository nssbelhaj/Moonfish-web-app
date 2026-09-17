import { contributions } from '@/lib/providers';
import { summarizeCatches } from '@/lib/contributions/catch-log';
import { succes } from '@/lib/api/reponse';
import { exigerLecteur } from '@/lib/api/garde';
import { priseDuCarnetEnJson } from '@/lib/api/serialisation';

export const dynamic = 'force-dynamic';

/**
 * Tout ce que l'application a besoin de savoir sur le compte connecté.
 *
 * ── Un seul appel, et c'est délibéré ─────────────────────────────────────
 *
 * Profil, favoris, sorties et carnet arrivent ensemble. Quatre routes
 * séparées seraient plus « propres » et coûteraient quatre allers-retours à
 * l'ouverture de l'application — sur une 4G faible au bord de l'eau, c'est la
 * différence entre un écran qui s'affiche et un écran qui tourne. Les quatre
 * lectures partent en parallèle côté serveur, sur des colonnes indexées.
 *
 * ── Le carnet est RÉSUMÉ ici, pas dans l'application ─────────────────────
 *
 * `summarizeCatches` est la fonction du site. Laisser le téléphone recalculer
 * « votre plus grande prise par espèce » créerait une seconde arithmétique,
 * pour la même raison qu'on refuse un second calcul du score. Et le résumé
 * n'ajoute aucune interprétation : « votre meilleur mois » est un fait,
 * « vous progressez » serait une flatterie qu'aucune donnée ne soutient.
 *
 * ── Les prises privées sortent ICI, et seulement ici ─────────────────────
 *
 * C'est le carnet de son auteur : il voit tout ce qu'il a déclaré. La route
 * publique d'un spot, elle, ne lit que les prises publiques, filtrées dans le
 * SQL. Les deux chemins sont distincts et le restent.
 */
export async function GET(requete: Request): Promise<Response> {
  const garde = await exigerLecteur(requete);
  if (!garde.ok) return garde.reponse;

  const { id, email } = garde.porteur;

  const [profil, siennes, favoris, sorties] = await Promise.all([
    contributions.getProfile(id),
    contributions.listForUser(id),
    contributions.listFavorites(id),
    contributions.listOutings(id),
  ]);

  return succes({
    account: { id, email },
    profile: profil,
    favorites: favoris,
    outings: sorties,
    reviews: siennes.reviews,
    catches: siennes.catches.map(priseDuCarnetEnJson),
    catchLog: summarizeCatches(siennes.catches),
  });
}
