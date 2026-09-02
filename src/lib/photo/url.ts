/**
 * URL d'affichage d'une photo de prise.
 *
 * La base ne stocke qu'un CHEMIN relatif, jamais une URL : une URL enregistrée
 * figerait le domaine, et une restauration ailleurs rendrait toutes les photos
 * introuvables. Le chemin, lui, ne dépend de rien.
 *
 * Les segments sont encodés : un chemin venu de la base n'est pas digne de
 * confiance, et il ne doit pas pouvoir sortir de `/api/photos/` en glissant un
 * `?` ou un `#` dans une URL.
 */
export function photoUrl(path: string | null): string | null {
  if (path === null || path.length === 0) return null;

  const segments = path
    .split('/')
    .filter((segment) => segment.length > 0 && segment !== '.' && segment !== '..');

  if (segments.length === 0) return null;

  return `/api/photos/${segments.map(encodeURIComponent).join('/')}`;
}
