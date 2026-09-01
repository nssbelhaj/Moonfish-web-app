'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

import { SUPABASE_CONFIG } from './config';
import type { Database } from './database.types';

let cached: SupabaseClient<Database> | null = null;

/**
 * Client Supabase du navigateur, créé une seule fois.
 *
 * En créer un par composant multiplierait les écouteurs de session et les
 * rafraîchissements de jeton concurrents.
 */
export function supabaseBrowser(): SupabaseClient<Database> | null {
  if (SUPABASE_CONFIG === null) return null;
  if (cached) return cached;

  cached = createBrowserClient<Database>(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
  return cached;
}
