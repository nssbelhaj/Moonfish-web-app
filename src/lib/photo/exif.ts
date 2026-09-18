/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  Le serveur ne se contente plus de SUPPOSER que la photo est nettoyée
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Le retrait des métadonnées a lieu sur l'appareil, avant tout envoi : ce qui
 * n'est jamais parti n'a pas à être effacé. C'est la bonne architecture et
 * elle ne change pas.
 *
 * Mais elle repose entièrement sur un client. Un client qu'on ne contrôle plus
 * une fois installé, qui existe en plusieurs versions simultanées sur des
 * téléphones qu'on ne met pas à jour, et dont la bibliothèque de réencodage
 * peut changer de comportement à une mise à jour du système. Le jour où ce
 * nettoyage régresse, PERSONNE ne s'en aperçoit : la photo s'affiche
 * normalement, la prise est enregistrée, et les coordonnées GPS du poste
 * dorment dans le fichier jusqu'à ce que quelqu'un les y cherche.
 *
 * Ce module est le second verrou. Il ne nettoie pas — nettoyer ici reviendrait
 * à accepter que l'original ait traversé le réseau — il REFUSE. Un envoi qui
 * porte encore un bloc Exif est rejeté avec un message qui dit quoi faire.
 *
 * ── Pourquoi chercher « Exif » et pas n'importe quel APP1 ────────────────
 *
 * Un JPEG réencodé porte souvent des segments applicatifs parfaitement
 * anodins : JFIF en APP0, un profil colorimétrique ICC en APP2 — Chromium en
 * ajoute un systématiquement. Les refuser en bloc ferait rejeter des photos
 * propres, et la règle deviendrait vite « désactivons ce contrôle ». On vise
 * donc exactement ce qui porte la géolocalisation : la signature `Exif\0\0`
 * en tête d'un APP1, et le XMP d'Adobe, qui transporte lui aussi des
 * coordonnées.
 */

/** Marqueurs qui n'ont pas de charge utile : on ne lit pas de longueur après eux. */
const SANS_CHARGE = new Set([0xd8, 0xd9, 0x01]);

export type VerdictExif =
  | { propre: true }
  | { propre: false; raison: 'exif' | 'xmp'; segment: string };

/**
 * Le fichier porte-t-il encore des métadonnées géolocalisables ?
 *
 * On parcourt les segments jusqu'à `SOS` (début des données image) : au-delà,
 * les octets sont de l'entropie compressée et y chercher une signature
 * produirait des faux positifs — « Exif » finit toujours par apparaître par
 * hasard dans assez de données.
 */
export function inspecterJpeg(octets: Uint8Array): VerdictExif {
  if (octets[0] !== 0xff || octets[1] !== 0xd8) return { propre: true };

  let i = 2;

  while (i + 3 < octets.length) {
    if (octets[i] !== 0xff) break;

    // Les octets de remplissage 0xFF se répètent légalement avant un marqueur.
    let marqueur = octets[i + 1]!;
    while (marqueur === 0xff && i + 2 < octets.length) {
      i += 1;
      marqueur = octets[i + 1]!;
    }

    // Début des données image : au-delà, plus de segments à lire.
    if (marqueur === 0xda || marqueur === 0xd9) break;
    if (SANS_CHARGE.has(marqueur)) {
      i += 2;
      continue;
    }

    const longueur = (octets[i + 2]! << 8) | octets[i + 3]!;
    if (longueur < 2) break;

    const debut = i + 4;
    const fin = Math.min(debut + longueur - 2, octets.length);

    if (marqueur === 0xe1) {
      const entete = new TextDecoder('latin1').decode(octets.subarray(debut, debut + 32));

      if (entete.startsWith('Exif\0\0')) {
        return { propre: false, raison: 'exif', segment: 'APP1/Exif' };
      }
      if (entete.startsWith('http://ns.adobe.com/xap/')) {
        return { propre: false, raison: 'xmp', segment: 'APP1/XMP' };
      }
    }

    i = fin;
  }

  return { propre: true };
}

/** Message affiché quand un envoi porte encore ses métadonnées. */
export const MESSAGE_REFUS: Record<'exif' | 'xmp', string> = {
  exif:
    'Cette photo porte encore ses métadonnées, dont la position GPS du lieu de prise de vue. Elle n’a pas été enregistrée. Mettez l’application à jour : le nettoyage doit avoir lieu sur votre appareil, avant l’envoi.',
  xmp:
    'Cette photo porte encore un bloc XMP, qui peut contenir sa position. Elle n’a pas été enregistrée. Mettez l’application à jour : le nettoyage doit avoir lieu sur votre appareil, avant l’envoi.',
};
