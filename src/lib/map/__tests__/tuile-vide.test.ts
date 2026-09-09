import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';

import { TUILE_VIDE } from '../tuile-vide';

/*
  ────────────────────────────────────────────────────────────────────────────
   Un base64 ne se relit pas à l'œil.

   Celui qui précédait était commenté « PNG transparent d'un pixel » et
   décodait en (0, 255, 0, 127) : du vert vif à moitié opaque. Le commentaire
   était faux, la revue de code ne pouvait pas le voir, et le défaut ne se
   manifestait que là où les tuiles échouent — c'est-à-dire nulle part en
   développement.

   Ce test décode réellement le PNG et lit son unique pixel.
  ────────────────────────────────────────────────────────────────────────────
*/

/** En-têtes de bloc PNG, dans l'ordre : longueur (4 o), type (4 o), données. */
function blocs(png: Buffer): Map<string, Buffer> {
  const trouves = new Map<string, Buffer>();
  let i = 8; // saute la signature

  while (i < png.length - 8) {
    const longueur = png.readUInt32BE(i);
    const type = png.toString('ascii', i + 4, i + 8);
    trouves.set(type, png.subarray(i + 8, i + 8 + longueur));
    i += 12 + longueur; // longueur + type + données + CRC
  }

  return trouves;
}

describe('la tuile servie quand le fond de carte manque', () => {
  it('est un PNG valide', () => {
    expect([...TUILE_VIDE.subarray(0, 8)]).toStrictEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  });

  it('fait un pixel sur un pixel, en RVBA', () => {
    const ihdr = blocs(TUILE_VIDE).get('IHDR');
    expect(ihdr).toBeDefined();

    expect(ihdr!.readUInt32BE(0)).toBe(1); // largeur
    expect(ihdr!.readUInt32BE(4)).toBe(1); // hauteur
    expect(ihdr![8]).toBe(8); // 8 bits par composante
    expect(ihdr![9]).toBe(6); // type 6 = couleur vraie avec alpha
  });

  it('son unique pixel est ENTIÈREMENT transparent, et noir', () => {
    /*
      Le test qui compte. Alpha à 0 suffirait à le rendre invisible ; on vérifie
      aussi les trois composantes de couleur, parce qu'un pixel « invisible mais
      vert » redeviendrait visible au moindre filtre CSS — et la carte en porte
      un en thème nuit.
    */
    const idat = blocs(TUILE_VIDE).get('IDAT');
    expect(idat).toBeDefined();

    const brut = inflateSync(idat!);
    // Une ligne de balayage : un octet de filtre, puis R, V, B, A.
    expect(brut.length).toBe(5);
    expect(brut[0], 'octet de filtre').toBe(0);

    const [, r, v, b, a] = brut;
    expect({ r, v, b, a }).toStrictEqual({ r: 0, v: 0, b: 0, a: 0 });
  });
});
