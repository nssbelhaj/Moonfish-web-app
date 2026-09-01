import { SUPABASE_CONFIG } from '@/lib/supabase/config';
import { PHOTO_BUCKET } from '@/lib/supabase/database.types';

/**
 * URL publique d'une photo de prise.
 *
 * Construite ici plutôt que stockée en base : une URL enregistrée fige le
 * domaine du projet, et une restauration ailleurs rendrait toutes les photos
 * introuvables. La base ne garde que le chemin, qui, lui, ne dépend de rien.
 */
export function photoUrl(path: string | null): string | null {
  if (path === null || SUPABASE_CONFIG === null) return null;
  return `${SUPABASE_CONFIG.url}/storage/v1/object/public/${PHOTO_BUCKET}/${path}`;
}
