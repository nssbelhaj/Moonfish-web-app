import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

/**
 * Photos de prises sur le disque.
 *
 * ─── Pourquoi PAS dans le répertoire de l'application ─────────────────────
 *
 * Un hébergeur qui déploie depuis Git REMPLACE le répertoire de l'application
 * à chaque build. Une photo écrite dedans disparaîtrait à la mise en ligne
 * suivante, sans erreur, sans trace, et personne ne ferait le lien entre « les
 * photos ont disparu » et « on a déployé mardi ».
 *
 * `UPLOADS_DIR` doit donc désigner un chemin EXTÉRIEUR au dépôt déployé.
 * `verifierEmplacement()` refuse un chemin situé sous le répertoire courant et
 * le dit à voix haute au démarrage, plutôt que de laisser la découverte se
 * faire par la perte de données.
 */

const DEFAULT_DIR = path.join(process.cwd(), 'var', 'photos');

export function uploadsDir(): string {
  return process.env.UPLOADS_DIR?.trim() || DEFAULT_DIR;
}

/**
 * L'emplacement survivra-t-il à un déploiement ?
 *
 * Rend un avertissement quand le répertoire est sous le dépôt. En
 * développement c'est normal et sans conséquence ; en production, c'est une
 * perte de données programmée.
 */
export function storageWarning(): string | null {
  const dir = path.resolve(uploadsDir());
  const root = path.resolve(process.cwd());

  if (!dir.startsWith(root + path.sep) && dir !== root) return null;
  if (process.env.NODE_ENV !== 'production') return null;

  return (
    `Les photos sont écrites dans ${dir}, à l’intérieur du répertoire de l’application. ` +
    'Un déploiement les effacera. Définissez UPLOADS_DIR vers un chemin extérieur.'
  );
}

/** Types acceptés au dépôt. Le nettoyage navigateur ne produit que du JPEG. */
const ACCEPTED = new Set(['image/jpeg']);

/** 3 Mo : une photo réduite à 1600 px et recompressée pèse 200 à 600 Ko. */
export const MAX_STORED_BYTES = 3 * 1024 * 1024;

export type SaveResult = { ok: true; path: string } | { ok: false; message: string };

/**
 * Enregistre une photo déjà nettoyée de ses métadonnées.
 *
 * Le chemin produit commence par l'identifiant de l'utilisateur. C'est ce qui
 * remplace le cloisonnement par dossier que la politique de stockage
 * PostgreSQL appliquait : `deletePhoto` refuse tout chemin qui sortirait de
 * cette arborescence.
 */
export async function savePhoto(
  userId: string,
  bytes: Uint8Array,
  contentType: string,
): Promise<SaveResult> {
  if (!ACCEPTED.has(contentType)) {
    return { ok: false, message: 'Format inattendu : la photo doit être un JPEG.' };
  }

  if (bytes.byteLength === 0) return { ok: false, message: 'Fichier vide.' };
  if (bytes.byteLength > MAX_STORED_BYTES) {
    return { ok: false, message: 'Photo trop lourde après traitement.' };
  }

  // Les octets doivent commencer par la signature JPEG. Se fier au type
  // déclaré par le navigateur suffirait à déposer n'importe quoi sous une
  // extension .jpg — un fichier HTML servi depuis notre domaine, par exemple.
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    return { ok: false, message: 'Ce fichier n’est pas une image JPEG.' };
  }

  if (!/^[0-9a-fA-F-]{36}$/.test(userId)) {
    return { ok: false, message: 'Identifiant utilisateur invalide.' };
  }

  const relative = path.posix.join(userId, `${randomUUID()}.jpg`);
  const absolute = path.join(uploadsDir(), relative);

  try {
    await mkdir(path.dirname(absolute), { recursive: true });
    await writeFile(absolute, bytes, { flag: 'wx' });
    return { ok: true, path: relative };
  } catch (error) {
    console.error('[photo] écriture impossible', error);
    return { ok: false, message: 'Enregistrement de la photo impossible.' };
  }
}

/**
 * Chemin absolu d'une photo, ou `null` si le chemin sort de l'arborescence.
 *
 * C'est LE contrôle qui compte pour la lecture : un chemin venu de la base
 * n'est pas digne de confiance par principe. « ../../etc/passwd » doit rendre
 * `null`, pas un fichier.
 */
export function resolvePhoto(relative: string): string | null {
  if (typeof relative !== 'string' || relative.length === 0) return null;
  if (relative.includes('\0')) return null;

  const root = path.resolve(uploadsDir());
  const absolute = path.resolve(root, relative);

  return absolute.startsWith(root + path.sep) ? absolute : null;
}

export async function photoExists(relative: string): Promise<boolean> {
  const absolute = resolvePhoto(relative);
  if (!absolute) return false;

  try {
    return (await stat(absolute)).isFile();
  } catch {
    return false;
  }
}

/** Supprime une photo. Un chemin hors arborescence est ignoré, jamais suivi. */
export async function deletePhoto(relative: string): Promise<void> {
  const absolute = resolvePhoto(relative);
  if (!absolute) {
    console.error('[photo] chemin refusé à la suppression', relative);
    return;
  }

  try {
    await rm(absolute, { force: true });
  } catch (error) {
    console.error('[photo] suppression impossible', error);
  }
}
