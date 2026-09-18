import { mkdir, mkdtemp, chmod, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { essaiPhotos } from '../essai-photos';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  L'essai d'écriture doit ÉCRIRE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Ces essais travaillent sur de vrais dossiers temporaires, sans simulacre de
 * `node:fs`. Un simulacre aurait validé la version qui ne vérifiait rien : le
 * défaut de production — un chemin configuré mais impossible à écrire — ne se
 * voit que quand on écrit pour de bon.
 */

const aNettoyer: string[] = [];

async function dossierTemporaire(): Promise<string> {
  const dossier = await mkdtemp(path.join(tmpdir(), 'essai-photos-'));
  aNettoyer.push(dossier);
  return dossier;
}

afterEach(async () => {
  for (const dossier of aNettoyer.splice(0)) {
    // Remettre les droits avant de retirer : un dossier passé en lecture seule
    // par un essai refuserait sa propre suppression.
    await chmod(dossier, 0o700).catch(() => undefined);
    await rm(dossier, { recursive: true, force: true }).catch(() => undefined);
  }
});

describe('essaiPhotos', () => {
  it('déclare « ok » un dossier existant où l’écriture passe', async () => {
    const point = await essaiPhotos(await dossierTemporaire());

    expect(point.etat).toBe('ok');
    expect(point.remede).toBeNull();
  });

  it('crée le dossier quand il manque, plutôt que de crier', async () => {
    const parent = await dossierTemporaire();
    const dossier = path.join(parent, 'photos', 'prises');

    const point = await essaiPhotos(dossier);

    expect(point.etat).toBe('ok');
  });

  it('ne laisse AUCUN fichier derrière lui', async () => {
    const dossier = await dossierTemporaire();

    await essaiPhotos(dossier);

    expect(await readdir(dossier)).toEqual([]);
  });

  it('ne touche pas aux photos déjà présentes', async () => {
    const dossier = await dossierTemporaire();
    await writeFile(path.join(dossier, 'prise-2026.jpg'), 'des octets');

    await essaiPhotos(dossier);

    expect(await readdir(dossier)).toEqual(['prise-2026.jpg']);
  });

  /*
    ── Faire échouer l'écriture, y compris sous root ────────────────────────

    Un dossier en lecture seule ne suffit pas : root écrit dedans quand même,
    et l'essai passerait au vert pour la mauvaise raison — il l'a fait ici,
    quatre essais sautés sans que rien ne soit prouvé. Un chemin dont le
    parent est un FICHIER échoue pour tout le monde, root compris : le noyau
    rend ENOTDIR avant toute question de droits.

    C'est aussi une vraie faute de configuration : UPLOADS_DIR posée sur un
    fichier existant.
  */
  async function dossierImpossible(): Promise<string> {
    const parent = await dossierTemporaire();
    const fichier = path.join(parent, 'pas-un-dossier');
    await writeFile(fichier, 'je suis un fichier');
    return path.join(fichier, 'photos');
  }

  it('déclare « absent » quand l’écriture est impossible', async () => {
    const point = await essaiPhotos(await dossierImpossible());

    expect(point.etat).toBe('absent');
    expect(point.remede).not.toBeNull();
  });

  it('nomme la cause système dans le constat', async () => {
    const point = await essaiPhotos(await dossierImpossible());

    expect(point.constat).toContain('ENOTDIR');
  });

  it('dit que le site ET l’application sont touchés, et que sans photo ça passe', async () => {
    const point = await essaiPhotos(await dossierImpossible());

    expect(point.constat).toContain('application');
    expect(point.constat).toContain('sans photo');
  });

  it('donne le remède qui correspond au code, pas un remède générique', async () => {
    const point = await essaiPhotos(await dossierImpossible());

    expect(point.remede).toContain('FICHIER');
    // Un refus de droits et un disque plein appellent des gestes opposés ;
    // servir l'un pour l'autre fait chercher une heure au mauvais endroit.
    expect(point.remede).not.toMatch(/espace disque/);
  });

  /*
    ── L'essai doit ÉCRIRE, pas seulement créer le dossier ──────────────────

    Les essais ci-dessus tombaient sur un chemin que `mkdir` refusait déjà :
    en retirant l'appel à `writeFile`, ils restaient tous verts. Ils
    vérifiaient la création du dossier — pas l'écriture, qui est pourtant la
    seule chose que la production a démentie.

    Ici le dossier se crée sans peine, et c'est le fichier qui ne peut pas
    s'écrire : un dossier porte déjà son nom. Root n'y change rien.
  */
  it('échoue quand le DOSSIER se crée mais que le fichier ne s’écrit pas', async () => {
    const dossier = await dossierTemporaire();
    const nom = '.essai-occupe';
    await mkdir(path.join(dossier, nom));

    const point = await essaiPhotos(dossier, nom);

    expect(point.etat).toBe('absent');
    // EEXIST, et non EISDIR : le drapeau « wx » refuse avant même de
    // regarder ce qu'il y a là. C'est bien `writeFile` qui parle — retirez
    // cet appel et cet essai repasse au vert par erreur.
    expect(point.constat).toContain('EEXIST');
  });

  it('propose un remède même pour un code système qu’il ne connaît pas', async () => {
    const dossier = await dossierTemporaire();
    const nom = '.essai-occupe';
    await mkdir(path.join(dossier, nom));

    const point = await essaiPhotos(dossier, nom);

    expect(point.remede).toContain(dossier);
  });

  /*
    Le cas des droits reste vérifié là où l'utilisateur n'est pas root — en
    local, chez la personne qui déploie. Sous root il est sauté, et les essais
    ci-dessus couvrent déjà la branche d'échec.
  */
  const nonRoot = typeof process.getuid === 'function' && process.getuid() !== 0;

  it.skipIf(!nonRoot)('déclare « absent » un dossier qui refuse l’écriture', async () => {
    const dossier = await dossierTemporaire();
    await chmod(dossier, 0o500); // lisible, traversable, non inscriptible

    const point = await essaiPhotos(dossier);

    expect(point.etat).toBe('absent');
  });

  it.skipIf(!nonRoot)('nomme la cause système ET le remède qui lui correspond', async () => {
    const dossier = await dossierTemporaire();
    await chmod(dossier, 0o500);

    const point = await essaiPhotos(dossier);

    expect(point.constat).toContain('EACCES');
    // Le remède d'un refus de droits parle de propriété, pas d'espace disque :
    // « vérifiez les droits » servi pour un disque plein fait chercher une
    // heure au mauvais endroit, et l'inverse aussi.
    expect(point.remede).toMatch(/propriété|UPLOADS_DIR/);
    expect(point.remede).not.toMatch(/espace disque/);
  });

  it.skipIf(!nonRoot)('ne recopie jamais le contenu d’une photo dans sa sortie', async () => {
    const dossier = await dossierTemporaire();
    const point = await essaiPhotos(dossier);

    expect(JSON.stringify(point)).not.toContain('essai-');
  });
});
