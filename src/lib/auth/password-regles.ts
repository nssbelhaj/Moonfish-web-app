/**
 * Règles de mot de passe, sans une ligne de cryptographie.
 *
 * ── Pourquoi ce fichier existe séparément ────────────────────────────────
 *
 * Les formulaires ont besoin de ces bornes pour poser `minLength` et écrire
 * l'aide sous le champ. Ils sont des composants CLIENT. Les prendre dans
 * `password.ts` y entraînait `node:crypto`, et le build a refusé net :
 * « Reading from "node:crypto" is not handled by plugins ».
 *
 * Le refus avait raison. Un module qui sait hacher n'a rien à faire dans un
 * paquet envoyé au navigateur — même si l'import n'était que celui d'un
 * nombre, tout le fichier serait parti avec.
 */

/**
 * Dix caractères, sans exigence de composition.
 *
 * Pas de « une majuscule, un chiffre, un caractère spécial » : ces règles
 * produisent des mots de passe courts et prévisibles (Motdepasse1!), et
 * poussent à les réutiliser. La longueur protège davantage, et une phrase
 * dont on se souvient vaut mieux qu'une suite qu'on note sur un papier.
 */
export const MOT_DE_PASSE_MIN = 10;

/**
 * Deux cents caractères. Une borne HAUTE est nécessaire : scrypt travaille sur
 * ce qu'on lui donne, et un envoi d'un mégaoctet ferait tourner le serveur
 * longtemps pour rien.
 */
export const MOT_DE_PASSE_MAX = 200;
