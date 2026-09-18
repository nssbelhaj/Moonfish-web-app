import { describe, expect, it } from 'vitest';

import { MESSAGE_REFUS, inspecterJpeg } from '../exif';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  Ce que ce test protège vraiment
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * La position d'un poste de pêche. Une photo de téléphone porte les
 * coordonnées GPS du lieu de prise de vue ; publier une photo de bar sans y
 * toucher, c'est publier la position d'un poste — ou, si elle a été prise en
 * rentrant, celle d'un domicile.
 *
 * Les JPEG sont FABRIQUÉS ici, octet par octet, plutôt que lus depuis des
 * fichiers d'essai. Un fichier binaire dans le dépôt ne se relit pas : on ne
 * sait plus ce qu'il contient, et le jour où le test échoue on ne peut pas
 * dire s'il a raison. Construits, ils portent exactement ce qu'on a voulu y
 * mettre, et la construction est lisible.
 */

const SOI = [0xff, 0xd8];
const EOI = [0xff, 0xd9];

/** Un segment applicatif : marqueur, longueur (charge + 2), charge. */
function segment(marqueur: number, charge: number[]): number[] {
  const longueur = charge.length + 2;
  return [0xff, marqueur, (longueur >> 8) & 0xff, longueur & 0xff, ...charge];
}

const texte = (s: string) => [...s].map((c) => c.charCodeAt(0));

/** Début de données image, suivi d'octets quelconques : après, on ne lit plus. */
const SOS = [0xff, 0xda, 0x00, 0x0c, ...Array(10).fill(0x00)];

const jpeg = (...morceaux: number[][]) => new Uint8Array(morceaux.flat());

/** Le bloc Exif d'un vrai appareil : signature, en-tête TIFF, puis les IFD. */
const EXIF_AVEC_GPS = segment(0xe1, [
  ...texte('Exif'),
  0x00,
  0x00,
  ...texte('II'),
  0x2a,
  0x00,
  0x08,
  0x00,
  0x00,
  0x00,
  // Contenu des IFD : sans importance pour la détection, qui se fait sur la
  // signature. Un bloc Exif présent suffit à refuser.
  ...Array(40).fill(0x00),
]);

describe('un JPEG qui porte encore son Exif est REFUSÉ', () => {
  it('reconnaît la signature Exif d’un APP1', () => {
    const verdict = inspecterJpeg(jpeg(SOI, EXIF_AVEC_GPS, SOS, EOI));

    expect(verdict.propre).toBe(false);
    if (!verdict.propre) {
      expect(verdict.raison).toBe('exif');
      expect(verdict.segment).toBe('APP1/Exif');
    }
  });

  it('le reconnaît même derrière d’autres segments', () => {
    // L'ordre des segments n'est pas garanti : JFIF vient souvent en premier,
    // un commentaire peut s'intercaler. Chercher uniquement en tête raterait
    // le cas le plus fréquent.
    const jfif = segment(0xe0, [...texte('JFIF'), 0x00, 0x01, 0x02, 0x00, 0x00]);
    const commentaire = segment(0xfe, texte('photo de bar'));

    const verdict = inspecterJpeg(jpeg(SOI, jfif, commentaire, EXIF_AVEC_GPS, SOS, EOI));
    expect(verdict.propre).toBe(false);
  });

  it('reconnaît aussi le XMP d’Adobe, qui transporte des coordonnées', () => {
    const xmp = segment(0xe1, [
      ...texte('http://ns.adobe.com/xap/1.0/'),
      0x00,
      ...texte('<x:xmpmeta/>'),
    ]);

    const verdict = inspecterJpeg(jpeg(SOI, xmp, SOS, EOI));
    expect(verdict.propre).toBe(false);
    if (!verdict.propre) expect(verdict.raison).toBe('xmp');
  });

  it('donne un message qui dit QUOI FAIRE, pas seulement ce qui ne va pas', () => {
    for (const message of Object.values(MESSAGE_REFUS)) {
      expect(message).toContain('position');
      expect(message).toContain('Mettez l’application à jour');
      // Et il dit ce qui est advenu du fichier : rien.
      expect(message).toContain('n’a pas été enregistrée');
    }
  });
});

describe('un JPEG propre passe — sans quoi la règle serait vite désactivée', () => {
  it('accepte un fichier réduit à ses pixels', () => {
    expect(inspecterJpeg(jpeg(SOI, SOS, EOI)).propre).toBe(true);
  });

  it('accepte le JFIF en APP0, qui ne porte aucune position', () => {
    const jfif = segment(0xe0, [...texte('JFIF'), 0x00, 0x01, 0x02, 0x00, 0x00]);
    expect(inspecterJpeg(jpeg(SOI, jfif, SOS, EOI)).propre).toBe(true);
  });

  it('accepte un profil colorimétrique ICC en APP2', () => {
    /*
      Chromium en ajoute un systématiquement au réencodage — c'est mesuré dans
      `scripts/verifier-exif.mjs`. Refuser tous les segments applicatifs en
      bloc ferait donc rejeter des photos parfaitement propres, et la règle
      deviendrait vite « désactivons ce contrôle ».
    */
    const icc = segment(0xe2, [...texte('ICC_PROFILE'), 0x00, 0x01, 0x01, ...Array(60).fill(0x00)]);
    expect(inspecterJpeg(jpeg(SOI, icc, SOS, EOI)).propre).toBe(true);
  });

  it('ne cherche RIEN après le début des données image', () => {
    /*
      Au-delà de SOS les octets sont de l'entropie compressée : « Exif » finit
      toujours par y apparaître par hasard dans assez de données. Chercher là
      produirait des refus aléatoires sur des photos propres — le pire des
      défauts, puisqu'il serait irreproductible.
    */
    const entropie = [...texte('Exif'), 0x00, 0x00, ...Array(200).fill(0x42)];
    expect(inspecterJpeg(jpeg(SOI, SOS, entropie, EOI)).propre).toBe(true);
  });

  it('ne se noie pas sur un fichier tronqué ou absurde', () => {
    // Un envoi coupé en cours de route arrive pour de vrai depuis un
    // téléphone. Il ne doit ni lever, ni boucler.
    expect(inspecterJpeg(new Uint8Array([0xff, 0xd8])).propre).toBe(true);
    expect(inspecterJpeg(new Uint8Array([0xff, 0xd8, 0xff, 0xe1])).propre).toBe(true);
    expect(inspecterJpeg(new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0x00, 0x00])).propre).toBe(true);
    expect(inspecterJpeg(new Uint8Array(0)).propre).toBe(true);
  });

  it('laisse passer ce qui n’est pas un JPEG — un autre contrôle s’en charge', () => {
    // `savePhoto` vérifie la signature avant d'appeler ce module : dupliquer
    // le refus ici donnerait deux messages pour la même cause.
    expect(inspecterJpeg(new Uint8Array([0x89, 0x50, 0x4e, 0x47])).propre).toBe(true);
  });
});
