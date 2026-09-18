import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  « Peut-on écrire ici ? » — la seule façon honnête de répondre
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Écrire un octet, puis le retirer. Aucune variable d'environnement ne dit ce
 * que cette fonction dit : entre un chemin configuré et un fichier qui
 * s'écrit, il y a la place pour un dossier qu'on n'a pas le droit de créer, un
 * montage en lecture seule, un quota atteint, un propriétaire qui n'est pas le
 * nôtre — et, sur un hébergement en conteneur, un disque qui n'existe tout
 * simplement pas de ce côté-ci.
 */
export type Ecriture = { ok: true; dossierCree: string | null } | { ok: false; code: string };

export async function peutEcrire(dossier: string, nom = `.essai-${randomUUID()}`): Promise<Ecriture> {
  const essai = path.join(dossier, nom);

  try {
    /*
      `mkdir` récursif rend le PREMIER dossier qu'il a créé, ou `undefined`
      quand il n'a rien eu à créer. C'est exactement ce qu'il faut pour ne
      laisser aucune trace : un essai qui sème des dossiers vides partout où
      il passe est un essai qu'on finit par ne plus lancer.
    */
    const dossierCree = (await mkdir(dossier, { recursive: true })) ?? null;
    await writeFile(essai, 'essai', { flag: 'wx' });
    await rm(essai, { force: true });

    return { ok: true, dossierCree };
  } catch (erreur) {
    await rm(essai, { force: true }).catch(() => undefined);
    return { ok: false, code: (erreur as NodeJS.ErrnoException).code ?? 'inconnu' };
  }
}
