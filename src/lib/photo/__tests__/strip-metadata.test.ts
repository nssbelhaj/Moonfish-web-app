import { describe, expect, it } from 'vitest';

import {
  ACCEPTED_TYPES,
  MAX_EDGE_PX,
  metadataMarkers,
  scaleToFit,
  stripAppSegments,
} from '../strip-metadata';

/** Petit JPEG synthétique : SOI, un segment donné, puis SOS. */
function jpegWith(segments: { marker: number; payload: number[] }[]): Uint8Array {
  const bytes: number[] = [0xff, 0xd8];

  for (const { marker, payload } of segments) {
    const length = payload.length + 2;
    bytes.push(0xff, marker, (length >> 8) & 0xff, length & 0xff, ...payload);
  }

  bytes.push(0xff, 0xda, 0x00, 0x02, 0x01, 0x02, 0x03);
  return new Uint8Array(bytes);
}

describe('détection des métadonnées', () => {
  it('repère un bloc EXIF', () => {
    // APP1 est le segment qui porte l'EXIF, donc les coordonnées GPS.
    const withExif = jpegWith([{ marker: 0xe1, payload: [0x45, 0x78, 0x69, 0x66, 0, 0] }]);
    expect(metadataMarkers(withExif)).toContain('APP1');
  });

  it('ne signale rien sur un JPEG sans segment de métadonnées', () => {
    const clean = jpegWith([{ marker: 0xdb, payload: [0x00, 0x01] }]);
    expect(metadataMarkers(clean)).toStrictEqual([]);
  });

  it('repère aussi l’IPTC, qui survit à bien des outils', () => {
    const withIptc = jpegWith([{ marker: 0xed, payload: [0x38, 0x42, 0x49, 0x4d] }]);
    expect(metadataMarkers(withIptc)).toContain('APP13');
  });

  it('parcourt les segments plutôt que de chercher des octets au hasard', () => {
    // 0xFFE1 apparaît fatalement dans les données compressées d'une vraie
    // photo. Une recherche naïve y verrait un EXIF fantôme et déclarerait
    // « échec du nettoyage » sur un fichier parfaitement propre.
    const bytes = jpegWith([{ marker: 0xdb, payload: [0x00, 0x01] }]);
    const withNoise = new Uint8Array([...bytes, 0xff, 0xe1, 0xff, 0xe1]);
    expect(metadataMarkers(withNoise)).toStrictEqual([]);
  });
});

describe('réduction', () => {
  it('ne touche pas à une image déjà petite', () => {
    expect(scaleToFit(800, 600)).toStrictEqual({ width: 800, height: 600 });
  });

  it('ramène le plus grand côté à la limite, en gardant les proportions', () => {
    const portrait = scaleToFit(3024, 4032);
    expect(portrait.height).toBe(MAX_EDGE_PX);
    expect(portrait.width).toBe(Math.round((3024 / 4032) * MAX_EDGE_PX));

    const paysage = scaleToFit(4032, 3024);
    expect(paysage.width).toBe(MAX_EDGE_PX);
  });

  it('ne produit jamais une dimension nulle', () => {
    const extreme = scaleToFit(10_000, 3);
    expect(extreme.height).toBeGreaterThanOrEqual(1);
  });
});

describe('formats acceptés', () => {
  it('accepte ce que produisent les téléphones', () => {
    for (const type of ['image/jpeg', 'image/heic']) expect(ACCEPTED_TYPES).toContain(type);
  });

  it('n’accepte ni SVG ni PDF', () => {
    // Un SVG est un document exécutable : accepté dans un seau public, il
    // deviendrait un vecteur de script hébergé sous notre domaine.
    for (const type of ['image/svg+xml', 'application/pdf', 'text/html']) {
      expect(ACCEPTED_TYPES).not.toContain(type);
    }
  });
});

describe('découpage des segments', () => {
  it('retire APP1, APP2 et les commentaires, garde APP0 et le reste', () => {
    const jpeg = jpegWith([
      { marker: 0xe0, payload: [0x4a, 0x46, 0x49, 0x46, 0x00] }, // APP0 : JFIF, conservé
      { marker: 0xe1, payload: [0x45, 0x78, 0x69, 0x66, 0, 0] }, // APP1 : EXIF, retiré
      { marker: 0xe2, payload: [0x49, 0x43, 0x43] }, // APP2 : profil ICC, retiré
      { marker: 0xfe, payload: [0x68, 0x65, 0x6c, 0x6c, 0x6f] }, // commentaire, retiré
      { marker: 0xdb, payload: [0x00, 0x01] }, // table de quantification : indispensable
    ]);

    const out = stripAppSegments(jpeg);
    expect(metadataMarkers(out)).toStrictEqual([]);

    // Ce qu'il ne faut SURTOUT pas emporter au passage : sans la table de
    // quantification ni les données compressées, le fichier ne serait plus une
    // image.
    expect(Array.from(out.subarray(0, 2))).toStrictEqual([0xff, 0xd8]);
    expect(out.length).toBeLessThan(jpeg.length);
    expect(Array.from(out).join(',')).toContain('219'); // 0xDB conservé
    expect(Array.from(out.subarray(-7))).toStrictEqual([0xff, 0xda, 0x00, 0x02, 0x01, 0x02, 0x03]);
  });

  it('laisse intact ce qui n’est pas un JPEG', () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
    expect(stripAppSegments(png)).toStrictEqual(png);
  });

  it('ne boucle pas sur un fichier tronqué', () => {
    const tronque = new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0x00]);
    expect(() => stripAppSegments(tronque)).not.toThrow();
  });
});
