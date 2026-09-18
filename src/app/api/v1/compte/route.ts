import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { contributions, spots } from '@/lib/providers';
import { spotPath } from '@/lib/routes';
import { summarizeCatches } from '@/lib/contributions/catch-log';
import {
  CORPS_ILLISIBLE,
  corpsJson,
  refusDeContribution,
  saisieInvalide,
  succes,
} from '@/lib/api/reponse';
import { exigerLecteur } from '@/lib/api/garde';
import { carnetEnJson, priseDuCarnetEnJson } from '@/lib/api/serialisation';

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
    // Sérialisé comme tout le reste : `summarizeCatches` rend des objets du
    // DOMAINE, qui portent `userId` et `photoPath`.
    catchLog: carnetEnJson(summarizeCatches(siennes.catches)),
  });
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  Effacement du compte — le droit à l'oubli, depuis le téléphone
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Il doit exister DANS l'application, pas seulement sur le site : l'App Store
 * l'exige de toute application qui permet de créer un compte, et c'est de
 * toute façon la bonne façon de tenir la promesse. Renvoyer quelqu'un vers un
 * navigateur pour effacer ce qu'il a créé ici serait une friction posée
 * exactement là où il ne faut pas.
 *
 * ── La confirmation est explicite, et c'est délibéré ─────────────────────
 *
 * Le corps doit porter « supprimer ». Un `DELETE /compte` nu effacerait un
 * compte sur un appel malencontreux — une requête rejouée, un bouton mal
 * câblé, un essai de développement contre la production. Le bouton voisin, sur
 * l'écran, est « se déconnecter » ; les deux ne se rattrapent pas de la même
 * façon.
 *
 * ── Les pages du site sont rafraîchies AVANT que les lignes ne disparaissent
 *
 * Défaut constaté en production côté web : le compte était bien supprimé et la
 * base vide, mais l'avis restait AFFICHÉ jusqu'à une heure sur la page du
 * spot, qui est pré-rendue. Un effacement qui se voit encore n'est pas un
 * effacement — et c'est la seule partie du droit à l'oubli que la personne
 * constate elle-même. Les spots concernés sont donc relevés d'abord : après,
 * on ne saurait plus quelles pages toucher.
 */
export async function DELETE(requete: Request): Promise<Response> {
  const garde = await exigerLecteur(requete);
  if (!garde.ok) return garde.reponse;

  const corps = await corpsJson(requete);
  if (corps === null) return CORPS_ILLISIBLE();

  const analyse = z
    .object({
      confirmation: z.literal('supprimer', {
        errorMap: () => ({ message: 'Recopiez le mot « supprimer » pour confirmer l’effacement.' }),
      }),
    })
    .safeParse(corps);

  if (!analyse.success) return saisieInvalide(analyse.error);

  const siennes = await contributions.listForUser(garde.porteur.id);
  const spotsTouches = new Set([
    ...siennes.reviews.map((avis) => avis.spotSlug),
    ...siennes.catches.map((prise) => prise.spotSlug),
  ]);

  const resultat = await contributions.deleteAccount(garde.porteur.id);
  if (!resultat.ok) return refusDeContribution(resultat);

  for (const slug of spotsTouches) {
    const spot = await spots.findBySlug(slug);
    if (spot !== null) revalidatePath(`${spotPath(spot)}/especes`);
  }

  /*
    La session vit en base et part avec l'utilisateur, par cascade : le jeton
    du téléphone ne désigne déjà plus rien. L'application l'efface quand même
    de son trousseau en recevant cette réponse.
  */
  return succes({ deleted: true });
}
