'use client';

import { stripMetadata } from './strip-metadata';

export type UploadResult = { ok: true; path: string } | { ok: false; message: string };

/**
 * Envoi d'une photo de prise.
 *
 * Ordre volontaire : on NETTOIE d'abord, on envoie ensuite. L'original ne
 * quitte jamais l'appareil — c'est la seule garantie qui tienne, un nettoyage
 * après réception arrivant toujours trop tard.
 *
 * Le fichier part vers NOTRE serveur, pas vers un tiers : aucune requête ne
 * sort du domaine, ce que la politique de confidentialité annonce.
 */
export async function uploadCatchPhoto(file: File): Promise<UploadResult> {
  const cleaned = await stripMetadata(file);
  if (!cleaned.ok) return { ok: false, message: cleaned.message };

  const form = new FormData();
  form.append('photo', new File([cleaned.blob], 'prise.jpg', { type: 'image/jpeg' }));

  try {
    const response = await fetch('/api/compte/photo', { method: 'POST', body: form });
    const payload = (await response.json()) as { ok?: boolean; path?: string; message?: string };

    if (!response.ok || !payload.ok || !payload.path) {
      return { ok: false, message: payload.message ?? 'Envoi de la photo impossible.' };
    }

    return { ok: true, path: payload.path };
  } catch {
    return { ok: false, message: 'Connexion impossible pendant l’envoi de la photo.' };
  }
}
