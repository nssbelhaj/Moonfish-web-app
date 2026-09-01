import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

import { SUPABASE_CONFIG } from './config';
import type { Database } from './database.types';

export type Client = SupabaseClient<Database>;

/**
 * Client Supabase pour un composant serveur ou un gestionnaire de route.
 *
 * Rend `null` quand les comptes ne sont pas configurés, plutôt que de lancer :
 * l'appelant doit pouvoir afficher « pas encore ouvert » sans try/catch, et un
 * déploiement sans Supabase doit se construire et servir normalement.
 */
export async function supabaseServer(): Promise<Client | null> {
  if (SUPABASE_CONFIG === null) return null;

  const cookieStore = await cookies();

  return createServerClient<Database>(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(toSet) {
        /*
          Un composant serveur ne PEUT pas écrire de cookie : Next lève. Le
          rafraîchissement de session appartient donc au middleware, et cet
          échec est normal — l'avaler ici est la démarche recommandée, pas un
          contournement. Sans ce try, chaque page rendue avec une session
          expirée renverrait une 500.
        */
        try {
          for (const { name, value, options } of toSet) cookieStore.set(name, value, options);
        } catch {
          // Sans effet : le middleware a déjà posé les cookies à jour.
        }
      },
    },
  });
}

/** Utilisateur connecté, ou `null`. */
export async function currentUser(): Promise<{ id: string; email: string | null } | null> {
  const client = await supabaseServer();
  if (!client) return null;

  // `getUser()` et non `getSession()` : la seconde lit le cookie sans le
  // vérifier, et un cookie se fabrique. La première valide le jeton auprès de
  // Supabase. La différence est exactement celle entre « le navigateur
  // prétend » et « le serveur atteste ».
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;

  return { id: data.user.id, email: data.user.email ?? null };
}
