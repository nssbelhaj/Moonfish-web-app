import type { Point } from './etat';
import { peutEcrire } from './ecriture';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  Essai RÉEL d'écriture dans le dossier des photos
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ── Pourquoi lire la configuration ne suffisait pas ──────────────────────
 *
 * Le diagnostic savait dire où les photos seraient écrites, et avertir quand
 * ce chemin était sous le dépôt. Les deux sont utiles et aucun des deux ne
 * répond à la seule question qui compte : **est-ce qu'on peut écrire ?**
 *
 * Constaté en production : toute déclaration de prise AVEC photo échouait sur
 * « Enregistrement de la photo impossible », tandis que la même déclaration
 * sans photo passait. Le site et l'application étaient touchés pareillement,
 * et rien nulle part ne le disait — ni au démarrage, ni dans le diagnostic,
 * ni dans le message rendu à la personne. Il a fallu envoyer une vraie photo
 * pour le découvrir.
 *
 * Entre « le chemin est configuré » et « le fichier s'écrit » il y a toute la
 * place pour : un dossier qui n'existe pas et qu'on n'a pas le droit de créer,
 * un montage en lecture seule, un quota de disque atteint, un propriétaire qui
 * n'est pas celui du processus. Aucun ne se voit dans une variable
 * d'environnement ; tous se voient en écrivant un octet.
 */
/*
  Le nom du fichier d'essai est INJECTABLE, et cette couture a une raison.

  Sans elle, le seul échec qu'un essai automatisé savait provoquer était un
  chemin impossible à créer — et `mkdir` suffisait alors à le faire échouer.
  Résultat : en retirant l'écriture de cette fonction, les essais restaient
  tous verts. Ils décrivaient la création du dossier, pas l'écriture, c'est-à-
  dire tout sauf ce que cette fonction existe pour vérifier.

  Avec un nom connu, l'essai peut poser un dossier à cette place exacte : la
  création du dossier passe, l'écriture échoue. Le sabotage est alors vu.
*/
export async function essaiPhotos(dossier: string, nom?: string): Promise<Point> {
  const sujet = 'Écriture des photos';
  const resultat = nom === undefined ? await peutEcrire(dossier) : await peutEcrire(dossier, nom);

  if (resultat.ok) {
    return {
      sujet,
      etat: 'ok',
      constat: `Le dossier ${dossier} existe et accepte l’écriture. Les photos de prises peuvent être enregistrées.`,
      remede: null,
    };
  }

  return {
    sujet,
    etat: 'absent',
    constat: `Impossible d’écrire dans ${dossier} (${resultat.code}). Toute déclaration de prise AVEC photo échoue, sur le site comme dans l’application ; sans photo, elle passe.`,
    remede: REMEDES[resultat.code] ?? `Vérifiez que ${dossier} existe et appartient à l’utilisateur qui fait tourner l’application.`,
  };
}

/**
 * Le remède dépend du code système, et la distinction vaut d'être faite.
 *
 * « Vérifiez les droits » envoyé pour un disque plein fait chercher au mauvais
 * endroit pendant une heure.
 */
const REMEDES: Record<string, string> = {
  EACCES:
    'Droits insuffisants. Donnez la propriété du dossier à l’utilisateur qui fait tourner Node, ou pointez UPLOADS_DIR vers un dossier de votre espace personnel.',
  EPERM:
    'Opération refusée par le système. Le dossier appartient probablement à un autre utilisateur, ou le montage est en lecture seule.',
  EROFS:
    'Le système de fichiers est en LECTURE SEULE. Pointez UPLOADS_DIR vers un emplacement accessible en écriture, hors du répertoire de l’application.',
  ENOSPC:
    'Plus d’espace disque. Libérez de la place ou augmentez le quota de l’hébergement ; ce n’est pas un problème de droits.',
  ENOTDIR:
    'Un élément du chemin est un FICHIER, pas un dossier. UPLOADS_DIR désigne probablement un fichier existant : pointez-la vers un dossier.',
  ENOENT:
    'Le chemin parent n’existe pas et n’a pas pu être créé. Créez-le à la main, puis vérifiez UPLOADS_DIR.',
  EDQUOT:
    'Quota de l’utilisateur atteint. Libérez de la place ou demandez une augmentation à l’hébergeur.',
};
