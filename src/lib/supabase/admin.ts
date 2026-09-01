import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

import { SUPABASE_CONFIG, serviceRoleKey } from './config';
import type { Database } from './database.types';

/**
 * Client à clé de service. Il contourne TOUTE la sécurité au niveau des lignes.
 *
 * Un seul usage légitime dans ce projet : effacer un compte de `auth.users`,
 * ce qu'un utilisateur ne peut pas faire lui-même. Tout le reste passe par le
 * client normal et ses politiques — c'est ce qui garantit qu'un bug de filtre
 * ne rende pas les données d'autrui.
 *
 * Ce module n'est jamais importé par un composant client : la clé n'a pas de
 * préfixe `NEXT_PUBLIC_`, elle ne peut donc pas être embarquée dans un paquet
 * navigateur.
 */
export function supabaseAdmin(): SupabaseClient<Database> | null {
  const key = serviceRoleKey();
  if (SUPABASE_CONFIG === null || key === null) return null;

  return createClient<Database>(SUPABASE_CONFIG.url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
