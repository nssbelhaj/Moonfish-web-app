/**
 * Retrait des métadonnées d'une photo, DANS LE NAVIGATEUR, avant tout envoi.
 *
 * Une photo prise au téléphone porte un bloc EXIF, et ce bloc contient les
 * coordonnées GPS du lieu de la prise de vue. Publier la photo d'un bar sans y
 * toucher, c'est publier la position exacte d'un poste que son auteur croyait
 * partager sans le donner — et, s'il a photographié sa prise en rentrant, la
 * position de son domicile.
 *
 * Le retrait doit avoir lieu ICI et pas sur le serveur : un nettoyage côté
 * serveur arriverait après que le fichier d'origine a traversé le réseau et
 * atterri dans le stockage. Ce qui n'est jamais parti n'a pas à être effacé.
 *
 * La méthode est le RÉENCODAGE, pas le découpage du seul bloc GPS. Décoder
 * l'image puis la redessiner dans un canevas ne conserve que les pixels : ni
 * EXIF, ni XMP, ni IPTC, ni vignette d'aperçu — cette dernière étant le piège
 * classique des outils qui retirent les coordonnées et laissent une miniature
 * intacte, elle-même géolocalisée.
 *
 * Mesuré dans un vrai navigateur, le réencodage laisse malgré tout UN segment :
 * le profil colorimétrique ICC que Chromium ajoute (APP2). Il ne contient
 * aucune donnée personnelle, mais il est retiré lui aussi — voir
 * `stripAppSegments` — pour que la phrase affichée à l'utilisateur soit vraie
 * sans réserve.
 *
 * La vérification n'est pas théorique : `scripts/verifier-exif.mjs` fabrique un
 * JPEG PORTANT des coordonnées GPS, le passe dans cette fonction au sein de
 * Chromium, et inspecte les octets de sortie.
 */

/** Côté le plus long après réduction. Au-delà, on transporte des pixels pour rien. */
export const MAX_EDGE_PX = 1600;

/** Au-delà, on refuse avant même de décoder : un téléphone récent produit 3 à 8 Mo. */
export const MAX_INPUT_BYTES = 12 * 1024 * 1024;

export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

export type StripFailure =
  | { ok: false; reason: 'type'; message: string }
  | { ok: false; reason: 'size'; message: string }
  | { ok: false; reason: 'decode'; message: string }
  | { ok: false; reason: 'encode'; message: string };

export type StripResult =
  | { ok: true; blob: Blob; width: number; height: number }
  | StripFailure;

/** Dimensions réduites en gardant les proportions. */
export function scaleToFit(
  width: number,
  height: number,
  maxEdge = MAX_EDGE_PX,
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { width, height };

  const ratio = maxEdge / longest;
  return { width: Math.max(1, Math.round(width * ratio)), height: Math.max(1, Math.round(height * ratio)) };
}

export async function stripMetadata(file: File, maxEdge = MAX_EDGE_PX): Promise<StripResult> {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return { ok: false, reason: 'type', message: 'Formats acceptés : JPEG, PNG, WebP ou HEIC.' };
  }

  if (file.size > MAX_INPUT_BYTES) {
    return { ok: false, reason: 'size', message: 'Photo trop lourde (12 Mo au maximum).' };
  }

  let bitmap: ImageBitmap;
  try {
    /*
      `imageOrientation: 'from-image'` applique la rotation EXIF au moment du
      décodage. Sans elle, une photo prise en portrait, dont le capteur a
      enregistré « tourner de 90° » plutôt que de tourner les pixels, ressort
      couchée : on aurait retiré la métadonnée d'orientation en même temps que
      le GPS, sans en tenir compte.
    */
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return { ok: false, reason: 'decode', message: 'Image illisible. Essayez un autre fichier.' };
  }

  const { width, height } = scaleToFit(bitmap.width, bitmap.height, maxEdge);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) {
    bitmap.close();
    return { ok: false, reason: 'encode', message: 'Traitement de l’image impossible.' };
  }

  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const encoded = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/jpeg', 0.85);
  });

  if (!encoded) return { ok: false, reason: 'encode', message: 'Compression de l’image impossible.' };

  /*
    Le réencodage ne suffit pas tout à fait : mesuré dans un vrai navigateur, le
    fichier produit par `toBlob` porte encore un segment APP2 — le profil
    colorimétrique ICC que Chromium ajoute. Il ne contient aucune donnée
    personnelle, mais laisser un segment de métadonnées obligerait à écrire
    « presque toutes les métadonnées sont retirées », et une promesse à demi
    n'a pas la même valeur qu'une promesse entière. On le retire donc aussi :
    un JPEG sans profil est interprété en sRVB, ce qui est exactement l'espace
    du canevas.
  */
  const stripped = stripAppSegments(new Uint8Array(await encoded.arrayBuffer()));
  const blob = new Blob([stripped], { type: 'image/jpeg' });

  return { ok: true, blob, width, height };
}

/**
 * Retire tous les segments APP1–APP15 et les commentaires d'un JPEG.
 *
 * APP0 (JFIF) est conservé : il ne porte que la densité de pixels, et certains
 * décodeurs anciens s'attendent à le trouver. Tout le reste part — EXIF, XMP,
 * IPTC, profil ICC, données constructeur.
 */
export function stripAppSegments(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  // Copie explicite plutôt que renvoi de l'entrée : le type de sortie doit
  // reposer sur un `ArrayBuffer` simple pour être accepté par `Blob`, ce qu'un
  // `Uint8Array` d'origine inconnue ne garantit pas.
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    return new Uint8Array(new ArrayBuffer(bytes.length)).fill(0).map((_, i) => bytes[i] as number);
  }

  const kept: Uint8Array[] = [bytes.subarray(0, 2)];
  let offset = 2;

  while (offset + 3 < bytes.length) {
    if (bytes[offset] !== 0xff) break;

    const marker = bytes[offset + 1] as number;
    // 0xDA ouvre les données compressées : tout ce qui suit est l'image.
    if (marker === 0xda) break;

    const length = ((bytes[offset + 2] as number) << 8) | (bytes[offset + 3] as number);
    if (length < 2) break;

    const removable = (marker >= 0xe1 && marker <= 0xef) || marker === 0xfe;
    if (!removable) kept.push(bytes.subarray(offset, offset + 2 + length));

    offset += 2 + length;
  }

  kept.push(bytes.subarray(offset));

  const total = kept.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(new ArrayBuffer(total));
  let at = 0;
  for (const part of kept) {
    out.set(part, at);
    at += part.length;
  }

  return out;
}

/**
 * Y a-t-il encore un segment de métadonnées dans ce JPEG ?
 *
 * Sert au contrôle : un fichier réencodé ne doit contenir AUCUN marqueur APP1
 * (EXIF, XMP) ni APP13 (IPTC). Fonction pure, donc vérifiable hors navigateur —
 * c'est elle qui permet de tester le retrait sur des octets réels plutôt que de
 * faire confiance au canevas.
 */
export function metadataMarkers(bytes: Uint8Array): string[] {
  const found: string[] = [];
  const NAMES: Record<number, string> = {
    0xe1: 'APP1', // EXIF, XMP — c'est là que vivent les coordonnées GPS
    0xe2: 'APP2', // profil ICC, ou index de photo multiple
    0xed: 'APP13', // IPTC
    0xee: 'APP14',
    0xfe: 'COM', // commentaire libre : certains appareils y écrivent le modèle
  };

  // Un JPEG est une suite de segments : 0xFF, un identifiant, puis la longueur
  // sur deux octets. On saute de segment en segment plutôt que de chercher des
  // octets au hasard, qui apparaîtraient aussi dans les données compressées.
  let offset = 2; // après SOI (FFD8)
  while (offset + 3 < bytes.length) {
    if (bytes[offset] !== 0xff) break;

    const marker = bytes[offset + 1] as number;
    if (marker === 0xda) break; // début des données compressées : plus de segments

    const length = ((bytes[offset + 2] as number) << 8) | (bytes[offset + 3] as number);
    if (length < 2) break;

    const name = NAMES[marker];
    if (name) found.push(name);

    offset += 2 + length;
  }

  return found;
}
