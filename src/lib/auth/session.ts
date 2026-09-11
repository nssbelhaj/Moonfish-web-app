import { cookies } from 'next/headers';

import { auth } from '@/auth';
import { databaseEnabled } from '@/lib/db/mysql';
import { nomDuCookie } from '@/lib/auth/session-cookie';
import { utilisateurDeSession } from '@/lib/providers/mysql/comptes';

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
    if (user?.id) return { id: user.id, email: user.email ?? null };
  } catch (error) {
    console.error('[auth] session illisible par la bibliothèque', error);
  }

  /*
    Auth.js ne LÈVE PAS sur `UntrustedHost` : il journalise et rend `null`.
    Mesuré — une première version ne branchait le second chemin que sur une
    exception, et ne se déclenchait donc jamais dans le cas qu'elle visait.

    On y passe aussi après un `null`. Le coût pour un visiteur anonyme est
    nul : `sessionDirecte()` ne touche la base que si un cookie de session
    existe, et un anonyme n'en a pas.
  */
  return sessionDirecte();
}

/**
 * Second chemin : lire la session nous-mêmes, dans NOTRE table.
 *
 * ── Pourquoi il existe ───────────────────────────────────────────────────
 *
 * Auth.js refuse de servir une requête dont l'hôte n'est pas déclaré de
 * confiance — `UntrustedHost`, quand `AUTH_URL` manque en production. Il lève
 * alors sur CHAQUE lecture de session. Le site ne plante pas, il fait pire :
 * il affiche un visiteur perpétuellement déconnecté. L'inscription
 * « réussit », la page suivante ne reconnaît personne, et aucun message
 * n'apparaît nulle part.
 *
 * ── Pourquoi ce n'est pas contourner une sécurité ────────────────────────
 *
 * `trustHost` protège les URL que la bibliothèque FABRIQUE à partir de
 * l'en-tête `Host` — typiquement le lien d'un courriel de connexion, qu'un
 * hôte falsifié enverrait ailleurs. Lire un jeton dans notre propre cookie et
 * le chercher dans notre propre table n'utilise aucune URL, donc ne touche à
 * rien de ce que ce contrôle protège.
 *
 * La session reste vérifiée comme avant : elle doit exister en base et ne pas
 * être expirée. Un jeton inventé ne donne rien.
 */
async function sessionDirecte(): Promise<{ id: string; email: string | null } | null> {
  if (!databaseEnabled()) return null;

  try {
    const jeton = (await cookies()).get(await nomDuCookie())?.value;
    if (!jeton) return null;

    return await utilisateurDeSession(jeton);
  } catch (error) {
    // Là, c'est une vraie panne : la base ne répond pas.
    console.error('[auth] lecture directe de session impossible', error);
    return null;
  }
}
