'use client';

import { supabaseBrowser } from '@/lib/supabase/browser';
import { PHOTO_BUCKET } from '@/lib/supabase/database.types';
import { stripMetadata } from './strip-metadata';

export type UploadResult = { ok: true; path: string } | { ok: false; message: string };

/**
 * Envoi d'une photo de prise.
 *
 * Ordre volontaire : on NETTOIE d'abord, on envoie ensuite. L'original ne
 * quitte jamais l'appareil — c'est la seule garantie qui tienne, un nettoyage
 * après réception arrivant toujours trop tard.
 *
 * Le chemin commence par l'identifiant de l'utilisateur, parce que la politique
 * de stockage exige que le premier dossier soit le sien : personne ne peut donc
 * écraser ni supprimer la photo d'un autre, quoi que fasse cette fonction.
 */
export async function uploadCatchPhoto(file: File, userId: string): Promise<UploadResult> {
  const client = supabaseBrowser();
  if (!client) return { ok: false, message: 'Envoi de photo indisponible.' };

  const cleaned = await stripMetadata(file);
  if (!cleaned.ok) return { ok: false, message: cleaned.message };

  const path = `${userId}/${crypto.randomUUID()}.jpg`;
  const { error } = await client.storage.from(PHOTO_BUCKET).upload(path, cleaned.blob, {
    contentType: 'image/jpeg',
    // Jamais d'écrasement : un nom déjà pris signale une collision d'UUID ou
    // une tentative d'écriture sur le fichier d'un autre, pas un remplacement
    // voulu.
    upsert: false,
  });

  if (error) {
    console.error('[photo] envoi impossible', error.message);
    return { ok: false, message: 'Envoi de la photo impossible. Réessayez.' };
  }

  return { ok: true, path };
}
