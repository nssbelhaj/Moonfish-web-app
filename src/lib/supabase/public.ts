import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { SUPABASE_CONFIG } from './config';
import type { Database } from './database.types';

let cached: SupabaseClient<Database> | null = null;

/**
 * Client SANS session : ni cookie lu, ni cookie écrit.
 *
 * C'est ce qui permet aux pages de spot de rester PRÉ-RENDUES. Lire les
 * cookies, même pour ne rien y trouver, bascule toute la route en rendu
 * dynamique dans Next : la page des espèces aurait perdu son cache d'une heure,
 * et chaque visiteur aurait payé deux requêtes de base pour un contenu
 * identique pour tous.
 *
 * Ce client ne voit donc que ce que la politique RLS accorde à `anon` : les
 * avis et les prises, qui sont publics. Il ne peut rien écrire, et ne peut lire
 * ni les profils ni la liste d'attente. La restriction est dans la base, pas
 * dans ce fichier.
 */
export function supabasePublic(): SupabaseClient<Database> | null {
  if (SUPABASE_CONFIG === null) return null;
  if (cached) return cached;

  cached = createClient<Database>(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  return cached;
}
