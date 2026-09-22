import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { auditPhotos } from '../audit-photos';

/**
 * Les JPEG sont CONSTRUITS ici, segment par segment. Une image binaire en
 * annexe aurait le défaut d'être illisible à la relecture : personne ne peut
 * vérifier qu'un fichier d'essai contient bien ce que son nom annonce, et un
 * essai qu'on ne peut pas relire finit par décrire autre chose que ce qu'on
 * croit.
 */
const SOI = Buffer.from([0xff, 0xd8]);
const SOS = Buffer.from([0xff, 0xda, 0x00, 0x02]);
const EOI = Buffer.from([0xff, 0xd9]);

function segment(marqueur: number, charge: Buffer): Buffer {
  const taille = Buffer.alloc(2);
  taille.writeUInt16BE(charge.length + 2);
  return Buffer.concat([Buffer.from([0xff, marqueur]), taille, charge]);
}

const propre = Buffer.concat([SOI, segment(0xe0, Buffer.from('JFIF\0')), SOS, EOI]);
const avecExif = Buffer.concat([SOI, segment(0xe1, Buffer.from('Exif\0\0quelque chose')), SOS, EOI]);
const avecXmp = Buffer.concat([
  SOI,
  segment(0xe1, Buffer.from('http://ns.adobe.com/xap/1.0/\0<x:xmpmeta/>')),
  SOS,
  EOI,
]);

const aNettoyer: string[] = [];

async function dossier(): Promise<string> {
  const d = await mkdtemp(path.join(tmpdir(), 'audit-photos-'));
  aNettoyer.push(d);
  return d;
}

afterEach(async () => {
  for (const d of aNettoyer.splice(0)) await rm(d, { recursive: true, force: true }).catch(() => undefined);
});

async function poser(racine: string, utilisateur: string, nom: string, octets: Buffer): Promise<void> {
  await mkdir(path.join(racine, utilisateur), { recursive: true });
  await writeFile(path.join(racine, utilisateur, nom), octets);
}

describe('auditPhotos', () => {
  it('ne prétend rien quand il n’y a aucune photo', async () => {
    const point = await auditPhotos(await dossier());

    expect(point.etat).toBe('ok');
    expect(point.constat).toContain('Aucune photo');
  });

  it('déclare saines des photos réellement sans métadonnées', async () => {
    const racine = await dossier();
    await poser(racine, 'u1', 'a.jpg', propre);
    await poser(racine, 'u2', 'b.jpg', propre);

    const point = await auditPhotos(racine);

    expect(point.etat).toBe('ok');
    expect(point.constat).toContain('2 photo');
    expect(point.remede).toBeNull();
  });

  it('repère une photo qui porte encore son Exif, et la nomme', async () => {
    const racine = await dossier();
    await poser(racine, 'u1', 'propre.jpg', propre);
    await poser(racine, 'u1', 'fautive.jpg', avecExif);

    const point = await auditPhotos(racine);

    expect(point.etat).toBe('absent');
    expect(point.constat).toContain('fautive.jpg');
    expect(point.constat).toContain('1 photo(s) stockée(s) sur 2');
  });

  it('repère aussi le XMP, qui porte les mêmes coordonnées sous un autre nom', async () => {
    const racine = await dossier();
    await poser(racine, 'u1', 'xmp.jpg', avecXmp);

    const point = await auditPhotos(racine);

    expect(point.etat).toBe('absent');
    expect(point.constat).toContain('xmp.jpg');
  });

  it('dit que la position peut s’y trouver — c’est l’enjeu, pas le format', async () => {
    const racine = await dossier();
    await poser(racine, 'u1', 'fautive.jpg', avecExif);

    const point = await auditPhotos(racine);

    expect(point.constat).toMatch(/position/i);
  });

  it('n’énumère pas trois cents chemins : il en montre cinq et compte le reste', async () => {
    const racine = await dossier();
    for (let i = 0; i < 9; i += 1) await poser(racine, 'u1', `f${i}.jpg`, avecExif);

    const point = await auditPhotos(racine);

    expect(point.constat).toContain('9 photo(s)');
    expect(point.constat).toContain('…');
    expect((point.constat.match(/\.jpg/g) ?? []).length).toBe(5);
  });

  it('ne se noie pas si le dossier en contient plus que le plafond', async () => {
    const racine = await dossier();
    for (let i = 0; i < 12; i += 1) await poser(racine, 'u1', `f${i}.jpg`, propre);

    const point = await auditPhotos(racine, 4);

    expect(point.constat).toContain('4 photo');
  });

  it('ignore ce qui n’est pas une photo', async () => {
    const racine = await dossier();
    await poser(racine, 'u1', 'a.jpg', propre);
    await poser(racine, 'u1', 'notes.txt', Buffer.from('rien à voir'));

    const point = await auditPhotos(racine);

    expect(point.constat).toContain('1 photo');
  });

  /*
    Un dossier illisible ne doit pas se lire comme « tout va bien ». C'est
    précisément la confusion qui a coûté le plus de temps sur ce sujet : une
    ligne verte qui décrivait autre chose que ce qu'on croyait.
  */
  it('avoue son ignorance quand le dossier est illisible, au lieu de rassurer', async () => {
    const point = await auditPhotos(path.join(await dossier(), 'inexistant'));

    expect(point.etat).not.toBe('ok');
    expect(point.constat).toMatch(/ne peut rien affirmer|n’a pas pu être parcouru/);
  });
});
