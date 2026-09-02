import { auth } from '@/auth';

/**
 * Utilisateur connecté, ou `null`.
 *
 * Point d'entrée unique du reste du code : aucune page, aucune action ne parle
 * directement à Auth.js. Ce qui permet, entre autres, d'avoir remplacé toute
 * la couche d'authentification sans toucher à une seule page.
 *
 * La session est lue EN BASE : elle ne peut pas être fabriquée côté client, et
 * une suppression de compte la rend immédiatement caduque.
 */
export async function currentUser(): Promise<{ id: string; email: string | null } | null> {
  try {
    const session = await auth();
    const user = session?.user;
    if (!user?.id) return null;

    return { id: user.id, email: user.email ?? null };
  } catch (error) {
    // Base injoignable ou configuration absente : personne n'est connecté.
    // Lever ici ferait tomber toutes les pages, y compris celles qui n'ont
    // aucun besoin de session.
    console.error('[auth] session illisible', error);
    return null;
  }
}
