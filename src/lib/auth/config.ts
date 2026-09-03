import { databaseEnabled } from '@/lib/db/mysql';

/**
 * Disponibilité des comptes, SANS importer la bibliothèque d'authentification.
 *
 * Ce module existe pour une raison de dépendances : le point de bascule des
 * fournisseurs (`src/lib/providers/index.ts`) a besoin de savoir si les
 * comptes sont ouverts, mais il ne doit pas tirer Auth.js avec lui. Sans cette
 * séparation, le simple fait de lire la liste des spots dans un test chargeait
 * tout le cadre d'authentification et échouait sur `next/server`.
 *
 * La règle générale : les couches basses ne connaissent pas les hautes.
 */

/**
 * Caractères qui, dans un mot de passe SMTP, détournent l'URL sans rien casser.
 *
 * ─── Mesuré, pas supposé ──────────────────────────────────────────────────
 *
 * Avec `smtp://boite@domaine.fr:MOT/PASSE@smtp.hebergeur.com:587`, l'analyseur
 * coupe au PREMIER « / » : l'hôte devient `domaine.fr` et le mot de passe
 * devient VIDE. La connexion part alors vers une machine qui n'est pas le
 * serveur d'envoi, avec des identifiants tronqués. Rien ne lève d'exception.
 * `?` et `#` font de même ; `%` ne détourne pas mais DÉCODE en silence.
 *
 * Le « @ », lui, passe sans encodage : l'analyseur retient le dernier comme
 * séparateur. La documentation de ce dépôt affirmait le contraire — c'était
 * faux, et cela envoyait chercher la panne au mauvais endroit.
 */
const SMTP_CASSANTS: readonly (readonly [string, string])[] = [
  ['/', '%2F'],
  ['?', '%3F'],
  ['#', '%23'],
  ['%', '%25'],
];

/**
 * Signale une URL SMTP détournée.
 *
 * On AVERTIT sans refuser : un « % » légitimement encodé est indiscernable
 * d'un « % » littéral, et bloquer un envoi qui fonctionne serait pire que le
 * laisser passer. Le message existe pour que la panne ait un nom le jour où
 * elle se produit — sinon elle se présente comme « le serveur ne répond pas ».
 */
export function smtpWarning(
  url: string | undefined = process.env.EMAIL_SERVER?.trim(),
): string | null {
  if (!url) return null;

  /*
    On isole le MOT DE PASSE, et lui seul.

    Une première version examinait tout ce qui précède le séparateur final.
    Elle signalait alors `smtp://boite%40domaine.fr:…` — un identifiant
    correctement encodé — comme une faute. Un avertissement qui se déclenche
    sur une configuration valide cesse d'être lu, ce qui le rend pire
    qu'absent.
  */
  const separateur = url.lastIndexOf('@');
  if (separateur === -1) return null;

  const schema = url.indexOf('://');
  const identifiant = url.slice(schema === -1 ? 0 : schema + 3, separateur);

  const deuxPoints = identifiant.indexOf(':');
  if (deuxPoints === -1) return null; // Pas de mot de passe : rien à vérifier.

  const motDePasse = identifiant.slice(deuxPoints + 1);

  const coupable = SMTP_CASSANTS.find(([caractere]) => motDePasse.includes(caractere));
  if (!coupable) return null;

  /*
    Le « % » demande une règle à part, et « suivi de deux chiffres hexadécimaux
    donc valide » ne marche pas : « GoT%100 » est syntaxiquement correct et se
    décode en « GoT\u0010 0 ». Mesuré. Le mot de passe part faux sans que rien
    ne le signale — le pire des trois cas, puisqu'il ressemble à un refus du
    serveur.

    On ne peut pas distinguer un code voulu d'un « % » littéral suivi par
    hasard de deux caractères hexadécimaux. On tolère donc exactement les
    encodages que la documentation recommande, et on signale tout le reste.
  */
  if (coupable[0] === '%') {
    const sansEncodagesConnus = motDePasse.replace(/%(25|2F|3F|23)/gi, '');
    if (!sansEncodagesConnus.includes('%')) return null;

    return (
      'EMAIL_SERVER : le mot de passe contient un « % ». Écrivez-le « %25 » — ' +
      'sinon il ouvre un code d’échappement et le mot de passe transmis n’est ' +
      'pas celui que vous avez saisi, sans lever d’erreur.'
    );
  }

  return (
    `EMAIL_SERVER : le mot de passe contient un « ${coupable[0]} ». ` +
    `Écrivez-le « ${coupable[1]} » — sinon l’adresse du serveur est tronquée et ` +
    'l’envoi part vers le mauvais hôte, sans lever d’erreur. ' +
    'Le « @ » de l’identifiant, lui, n’a rien à encoder.'
  );
}

function smtpServer(): string | undefined {
  const url = process.env.EMAIL_SERVER?.trim();
  return url && url.length > 0 ? url : undefined;
}

/** L'envoi de courriel est-il configuré ? Sans lui, aucune connexion possible. */
export function mailEnabled(): boolean {
  return smtpServer() !== undefined && (process.env.EMAIL_FROM?.trim() ?? '').length > 0;
}

/**
 * Les comptes sont ouverts quand la base ET l'envoi de courriel sont
 * configurés.
 *
 * Les deux, pas l'un ou l'autre : une base sans courriel donnerait un
 * formulaire de connexion qui n'envoie jamais rien, et un courriel sans base
 * n'aurait nulle part où écrire la session.
 */
export function accountsEnabled(): boolean {
  return databaseEnabled() && mailEnabled();
}

/**
 * Les connexions vont-elles échouer faute d'hôte de confiance ?
 *
 * ─── La panne, telle qu'elle se présente ──────────────────────────────────
 *
 * Auth.js v5 refuse de servir une requête d'authentification si l'hôte n'est
 * pas déclaré digne de confiance. Le défaut est calculé ainsi
 * (`@auth/core/lib/utils/env.js`) :
 *
 *   trustHost ??= !!(AUTH_URL ?? AUTH_TRUST_HOST ?? VERCEL ?? CF_PAGES
 *                    ?? NODE_ENV !== 'production')
 *
 * En développement, `NODE_ENV !== 'production'` suffit. Sur Vercel, `VERCEL`
 * suffit. Sur un hébergement mutualisé en production, AUCUNE de ces
 * conditions n'est remplie : il faut `AUTH_URL`.
 *
 * ─── Pourquoi cela méritait un avertissement ──────────────────────────────
 *
 * Reproduit avant d'écrire ces lignes. Sans `AUTH_URL`, en production : la
 * page `/compte` répond 200, le formulaire de connexion s'affiche
 * normalement, on saisit son adresse — et la demande sort en 500 avec
 * `UntrustedHost` dans le journal. AUCUN courriel ne part, jamais.
 *
 * Le message montré à la personne était alors « Le service de connexion ne
 * répond pas. Ce n'est pas votre adresse : réessayez plus tard. » C'est vrai
 * sur le fond et trompeur sur la durée : « plus tard » n'arrivera pas, la
 * configuration ne se corrigera pas d'elle-même.
 */
export function authHostWarning(): string | null {
  if (process.env.NODE_ENV !== 'production') return null;

  // L'avertissement ne concerne que les déploiements où les comptes sont
  // censés fonctionner : ailleurs, il n'y a rien à casser.
  if (!accountsEnabled()) return null;

  const confiance =
    process.env.AUTH_URL ??
    process.env.AUTH_TRUST_HOST ??
    process.env.VERCEL ??
    process.env.CF_PAGES;

  if (confiance) return null;

  return (
    'AUTH_URL n’est pas définie : Auth.js refusera CHAQUE requête de connexion ' +
    '(UntrustedHost), et aucun courriel de connexion ne partira. La page ' +
    'affichera « le service de connexion ne répond pas », ce qui laissera croire ' +
    'à une panne passagère. Définissez AUTH_URL sur l’adresse publique du site, ' +
    'par exemple AUTH_URL=https://lunamarea.fr'
  );
}

export { smtpServer };
