import { mkdtemp, readdir, rm, writeFile, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { emplacementsPossibles, candidats } from '../emplacements';

/**
 * Ces essais travaillent sur de vrais dossiers. Un simulacre de `node:fs`
 * aurait validé la version qui ne vérifie rien — et c'est précisément la
 * version qui a laissé passer la panne de production.
 */

const aNettoyer: string[] = [];

async function dossierTemporaire(): Promise<string> {
  const dossier = await mkdtemp(path.join(tmpdir(), 'emplacements-'));
  aNettoyer.push(dossier);
  return dossier;
}

afterEach(async () => {
  for (const dossier of aNettoyer.splice(0)) {
    await chmod(dossier, 0o700).catch(() => undefined);
    await rm(dossier, { recursive: true, force: true }).catch(() => undefined);
  }
});

describe('emplacementsPossibles', () => {
  it('nomme l’utilisateur sous lequel Node tourne', async () => {
    const point = await emplacementsPossibles({ HOME: await dossierTemporaire() }, await dossierTemporaire());

    expect(point.constat).toMatch(/Node tourne sous .+\(uid \d+\)/);
  });

  it('essaie chaque candidat et rend une ligne par emplacement', async () => {
    const appDir = await dossierTemporaire();
    const home = await dossierTemporaire();

    const point = await emplacementsPossibles({ HOME: home }, appDir);
    const lignes = point.constat.split('\n').filter((l) => l.startsWith('•'));

    expect(lignes.length).toBeGreaterThanOrEqual(4);
    expect(point.constat).toContain(path.join(home, 'luna-marea-photos'));
    expect(point.constat).toContain(path.join(appDir, 'var', 'photos'));
  });

  /*
    Le défaut que cet essai attrape : semer des dossiers vides dans le compte
    de quelqu'un à chaque consultation du diagnostic.
  */
  it('ne laisse AUCUN dossier derrière lui', async () => {
    const appDir = await dossierTemporaire();
    const home = await dossierTemporaire();

    await emplacementsPossibles({ HOME: home }, appDir);

    expect(await readdir(home)).toEqual([]);
    expect(await readdir(appDir)).toEqual([]);
  });

  it('ne touche pas à un dossier qui existait déjà, ni à son contenu', async () => {
    const appDir = await dossierTemporaire();
    const home = await dossierTemporaire();
    const deja = path.join(home, 'luna-marea-photos');
    await writeFile(path.join(await mkdtemp(deja + '-'), 'x'), 'x').catch(() => undefined);
    const { mkdir } = await import('node:fs/promises');
    await mkdir(deja, { recursive: true });
    await writeFile(path.join(deja, 'prise-2026.jpg'), 'des octets');

    await emplacementsPossibles({ HOME: home }, appDir);

    expect(await readdir(deja)).toEqual(['prise-2026.jpg']);
  });

  it('marque « ne survit pas » un emplacement situé dans l’application', async () => {
    const appDir = await dossierTemporaire();

    const point = await emplacementsPossibles({ HOME: await dossierTemporaire() }, appDir);
    const ligne = point.constat.split('\n').find((l) => l.includes(path.join(appDir, 'var', 'photos')))!;

    expect(ligne).toContain('NE SURVIT PAS');
  });

  it('rend le code système du refus, pas un « échec » sans cause', async () => {
    const appDir = await dossierTemporaire();
    // Un HOME dont le parent est un fichier : impossible à créer, pour root aussi.
    const bloque = path.join(appDir, 'pas-un-dossier');
    await writeFile(bloque, 'je suis un fichier');

    const point = await emplacementsPossibles({ HOME: bloque }, appDir);
    const ligne = point.constat.split('\n').find((l) => l.includes(bloque))!;

    expect(ligne).toMatch(/refusé \(ENOTDIR\)/);
  });

  it('propose le premier emplacement durable qui accepte l’écriture', async () => {
    const home = await dossierTemporaire();

    const point = await emplacementsPossibles({ HOME: home }, await dossierTemporaire());

    expect(point.remede).toContain(path.join(home, 'luna-marea-photos'));
    // « écriture OK » ne prouve pas la persistance, et le remède doit le dire.
    expect(point.remede).toMatch(/AVANT un déploiement|persistance/);
  });

  /*
    Le cas qui décide de toute la suite : si rien de durable n'accepte
    l'écriture, aucun réglage de UPLOADS_DIR ne sauvera les photos, et
    continuer à en chercher un fait perdre des heures.

    Impossible à provoquer sur une vraie machine sans la rendre inutilisable :
    la liste est donc injectée, et chaque candidat durable pointe derrière un
    fichier — ce qu'aucun système, root compris, n'accepte de traverser.
  */
  it('dit qu’il faut ranger les photos ailleurs quand rien de durable n’accepte l’écriture', async () => {
    const appDir = await dossierTemporaire();
    const bloque = path.join(appDir, 'pas-un-dossier');
    await writeFile(bloque, 'je suis un fichier');

    const point = await emplacementsPossibles({}, appDir, [
      { chemin: path.join(bloque, 'a'), survie: 'inconnue', pourquoi: 'Disque du compte.' },
      { chemin: path.join(bloque, 'b'), survie: 'inconnue', pourquoi: 'À côté de l’application.' },
      { chemin: path.join(appDir, 'ephemere'), survie: 'non', pourquoi: 'Dossier temporaire.' },
    ]);

    expect(point.etat).toBe('absent');
    expect(point.remede).toMatch(/base de données|stockage objet/);
    // Un emplacement éphémère inscriptible ne doit PAS être proposé : une
    // photo qui disparaît au déploiement suivant est pire qu'un refus franc.
    expect(point.remede).not.toContain('ephemere');
  });

  it('dit que le déploiement n’a aucun disque quand pas un seul candidat n’écrit', async () => {
    const appDir = await dossierTemporaire();
    const bloque = path.join(appDir, 'pas-un-dossier');
    await writeFile(bloque, 'je suis un fichier');

    const point = await emplacementsPossibles({}, appDir, [
      { chemin: path.join(bloque, 'a'), survie: 'inconnue', pourquoi: 'Disque du compte.' },
      { chemin: path.join(bloque, 'b'), survie: 'non', pourquoi: 'Dossier temporaire.' },
    ]);

    expect(point.etat).toBe('absent');
    expect(point.remede).toContain('AUCUN emplacement');
  });

  it('la liste par défaut couvre le HOME, le voisinage de l’application et le temporaire', async () => {
    const appDir = await dossierTemporaire();
    const home = await dossierTemporaire();

    const chemins = candidats({ HOME: home }, appDir).map((c) => c.chemin);

    expect(chemins).toContain(path.join(home, 'luna-marea-photos'));
    expect(chemins).toContain(path.resolve(appDir, '..', 'luna-marea-photos'));
    expect(chemins.some((c) => c.startsWith(tmpdir()))).toBe(true);
    // Aucun doublon : deux essais sur le même dossier n'apprennent rien et
    // allongent une page qu'on lit en panne.
    expect(new Set(chemins).size).toBe(chemins.length);
  });
});
