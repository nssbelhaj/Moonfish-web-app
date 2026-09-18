import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

import type { Point } from './etat';
import { inspecterJpeg } from '@/lib/photo/exif';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  Ce qui est RÉELLEMENT sur le disque porte-t-il encore des métadonnées ?
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ── Pourquoi on ne peut pas le vérifier depuis l'extérieur ───────────────
 *
 * Constaté en cherchant à prouver la promesse : le CDN de l'hébergeur
 * RÉ-ENCODE les images qu'il sert. Une photo de 2400 px et 238 Ko revient en
 * 1600 px et 78 Ko, avec un bloc Exif tout neuf écrit par l'encodeur du CDN —
 * et en WebP si le client l'accepte. Ni `Cache-Control: no-transform`, ni
 * l'absence d'en-tête `Accept`, ni une requête partielle n'y changent rien.
 *
 * Autrement dit : télécharger une photo et l'inspecter ne dit RIEN du fichier
 * stocké. Cela décrit le CDN. La vérification faite ainsi paraissait
 * concluante et ne prouvait pas ce qu'elle annonçait — c'est exactement le
 * genre de preuve qu'il vaut mieux ne pas avoir que d'avoir fausse.
 *
 * Alors on demande au serveur, qui lit le disque, et on rend un VERDICT en
 * JSON. Le CDN ne transforme pas du JSON.
 *
 * ── Ce que cet audit couvre, et ce qu'il ne couvre pas ───────────────────
 *
 * Il relit chaque photo stockée avec la MÊME fonction que celle qui garde
 * l'entrée. Il ne prouve donc pas que la garde est juste — il prouve qu'elle
 * a bien été appliquée à tout ce qui est là, y compris aux fichiers déposés
 * avant qu'elle n'existe.
 */
export async function auditPhotos(dossier: string, plafond = 500): Promise<Point> {
  const sujet = 'Métadonnées des photos stockées';

  let fichiers: string[];
  try {
    fichiers = await lister(dossier, plafond);
  } catch (erreur) {
    const code = (erreur as NodeJS.ErrnoException).code ?? 'inconnu';
    return {
      sujet,
      etat: 'attention',
      constat: `Le dossier des photos n’a pas pu être parcouru (${code}). L’audit ne peut rien affirmer.`,
      remede: 'Réglez d’abord l’écriture des photos ; cet audit redeviendra lisible ensuite.',
    };
  }

  if (fichiers.length === 0) {
    return {
      sujet,
      etat: 'ok',
      constat: 'Aucune photo stockée pour l’instant — rien à auditer.',
      remede: null,
    };
  }

  const fautives: string[] = [];
  for (const fichier of fichiers) {
    const verdict = inspecterJpeg(new Uint8Array(await readFile(fichier)));
    if (!verdict.propre) fautives.push(`${path.relative(dossier, fichier)} (${verdict.segment})`);
  }

  if (fautives.length === 0) {
    return {
      sujet,
      etat: 'ok',
      constat: `Les ${fichiers.length} photo(s) stockée(s) ont été relues sur le disque : aucune ne porte d’Exif ni de XMP. Ni position, ni date, ni numéro de série d’appareil.`,
      remede: null,
    };
  }

  /*
    On nomme les premières et on s'arrête : une liste de trois cents chemins
    ne se lit pas, et le geste à faire est le même pour une que pour trois
    cents.
  */
  const montrees = fautives.slice(0, 5);
  return {
    sujet,
    etat: 'absent',
    constat: `${fautives.length} photo(s) stockée(s) sur ${fichiers.length} portent encore des métadonnées : ${montrees.join(', ')}${fautives.length > montrees.length ? ', …' : ''}. Elles peuvent contenir la position exacte du poste de pêche.`,
    remede:
      'Ces fichiers sont antérieurs au refus à l’entrée, ou ont été déposés par un autre chemin. Effacez-les, ou ré-encodez-les hors ligne ; le refus à l’entrée empêche seulement les NOUVEAUX.',
  };
}

/** Les photos sont rangées par utilisateur : un seul niveau de sous-dossiers. */
async function lister(dossier: string, plafond: number): Promise<string[]> {
  const trouves: string[] = [];

  for (const entree of await readdir(dossier, { withFileTypes: true })) {
    if (trouves.length >= plafond) break;
    const complet = path.join(dossier, entree.name);

    if (entree.isDirectory()) {
      for (const enfant of await readdir(complet)) {
        if (trouves.length >= plafond) break;
        if (!enfant.toLowerCase().endsWith('.jpg')) continue;
        const chemin = path.join(complet, enfant);
        if ((await stat(chemin)).isFile()) trouves.push(chemin);
      }
    } else if (entree.name.toLowerCase().endsWith('.jpg')) {
      trouves.push(complet);
    }
  }

  return trouves;
}
