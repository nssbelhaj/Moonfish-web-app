/**
 * Le champ-piège : ce que nous mettons à la place d'un CAPTCHA.
 *
 * ─── Pourquoi pas reCAPTCHA, hCaptcha ou Turnstile ────────────────────────
 *
 * La page de confidentialité affirme qu'aucune requête ne part du navigateur
 * vers un tiers, et `privacy-claims.test.ts` échoue si un seul apparaît. Poser
 * un CAPTCHA hébergé ailleurs ferait de chaque visiteur un visiteur de Google
 * ou de Cloudflare AVANT même qu'il ait un compte, et rendrait cette phrase
 * fausse. On ne garde pas une promesse en la réécrivant.
 *
 * ─── Ce que ça vaut, honnêtement ──────────────────────────────────────────
 *
 * Un champ-piège arrête les robots qui remplissent tous les champs d'un
 * formulaire, c'est-à-dire la grande majorité de ceux qui passent. Il n'arrête
 * pas un script écrit POUR ce site. C'est la première ligne, pas la seule :
 * `BUDGETS.inscriptionIp` limite déjà à cinq inscriptions par heure et par
 * accès, et c'est elle qui tient contre l'acharnement.
 *
 * Si un jour cela ne suffit plus, la suite est Altcha hébergé chez nous —
 * une preuve de travail servie depuis notre propre domaine, sans tiers et
 * sans image à déchiffrer. Pas un CAPTCHA d'un autre.
 *
 * ─── Accessibilité ────────────────────────────────────────────────────────
 *
 * Le champ est hors écran, `aria-hidden`, et retiré du parcours au clavier.
 * Ce n'est pas de la décoration : un champ simplement déplacé hors écran
 * resterait lu par un lecteur d'écran, et la personne qui le remplirait
 * verrait son inscription refusée sans comprendre pourquoi. Un piège qui
 * attrape des humains n'est pas un piège, c'est une panne.
 */

/** Nom du champ. Crédible pour un robot, sans rapport avec le formulaire. */
export const CHAMP_PIEGE = 'site_web';

/**
 * Le formulaire a-t-il été rempli par un robot ?
 *
 * Vrai dès que le champ porte autre chose que du vide. Un humain ne peut ni
 * le voir, ni l'atteindre au clavier, ni se le faire lire.
 */
export function piegeDeclenche(formData: FormData): boolean {
  const valeur = formData.get(CHAMP_PIEGE);
  return typeof valeur === 'string' && valeur.trim().length > 0;
}
