import { cookies, headers } from 'next/headers';

import { creerSession, supprimerSession } from '@/lib/providers/mysql/comptes';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  Ouvrir une session sans passer par Auth.js
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ── Pourquoi ce contournement existe ─────────────────────────────────────
 *
 * Auth.js refuse le fournisseur « identifiants » quand les sessions sont en
 * base : `assert.js` rend `UnsupportedStrategy — Signing in with credentials
 * only supported if JWT strategy is enabled`. Sa voie officielle serait donc
 * de passer les sessions en jeton signé.
 *
 * Ce serait perdre la propriété qui a justifié le choix inverse : une session
 * en base se révoque IMMÉDIATEMENT — déconnexion, suppression de compte,
 * partout, tout de suite. Un jeton auto-porté reste valable jusqu'à son
 * expiration, y compris après un « supprimez mes données ». Sur un site qui
 * promet exactement cela, la régression est inacceptable.
 *
 * On écrit donc la ligne de session nous-mêmes, dans LA MÊME table que
 * l'adaptateur, avec le MÊME nom de cookie. Auth.js relit ensuite la session
 * sans savoir qui l'a créée : `getSessionAndUser` ne fait qu'un `select` sur
 * `sessionToken`.
 *
 * ── Ce module n'écrit AUCUN SQL ──────────────────────────────────────────
 *
 * Il l'a fait dans sa première version, et `proprietaire.test.ts` l'a refusé :
 * le SQL n'a le droit d'exister que dans les modules de la couche de données.
 * La règle a l'air formelle ; elle vaut ici, où mélanger la manipulation d'un
 * cookie et l'écriture d'une session rendrait les deux plus difficiles à
 * relire.
 *
 * ── Le couplage, nommé ───────────────────────────────────────────────────
 *
 * Ce module dépend de deux détails internes d'Auth.js : le NOM du cookie, et
 * la RÈGLE qui décide de son préfixe. Les deux vivent dans
 * `@auth/core/lib/utils/cookie.js` et `lib/init.js`, qui ne sont pas des
 * interfaces publiques. `session-cookie.test.ts` relit ces fichiers et échoue
 * si l'un ou l'autre change.
 *
 * ── La règle du préfixe se lit sur la REQUÊTE, pas sur l'environnement ───
 *
 * Auth.js calcule `useSecureCookies ?? url.protocol === 'https:'`, où `url`
 * est celle de la requête en cours. La première version d'ici lisait
 * `AUTH_URL`, `NEXTAUTH_URL` puis `NEXT_PUBLIC_SITE_URL` — trois variables
 * d'environnement.
 *
 * Sur un site servi en HTTPS dont aucune de ces variables n'était posée, les
 * deux camps ne s'accordaient plus : l'inscription écrivait
 * `authjs.session-token`, et Auth.js cherchait `__Secure-authjs.session-token`.
 * L'inscription « réussissait », et la page suivante affichait un visiteur
 * déconnecté. Observé en production, sans le moindre message d'erreur.
 *
 * On lit donc la même chose qu'Auth.js : le protocole de la requête, que le
 * proxy de l'hébergeur annonce dans `x-forwarded-proto`.
 */

/** Ce que déclare `defaultCookies()` d'Auth.js. Vérifié par test. */
const NOM_COOKIE = 'authjs.session-token';
const PREFIXE_SECURISE = '__Secure-';

/** Trente jours, comme `session.maxAge` déclaré dans `src/auth.ts`. */
export const DUREE_SESSION_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Le cookie est-il servi en HTTPS ?
 *
 * Auth.js applique le préfixe `__Secure-` d'après l'URL du site. On applique
 * la même règle sur la même source : un désaccord ferait écrire un cookie que
 * la bibliothèque ne relirait jamais, et la connexion « réussirait » sans
 * ouvrir de session.
 */
export interface ConditionsCookie {
  /** En-tête `x-forwarded-proto` de la requête, tel que le proxy l'annonce. */
  protocoleTransmis?: string | undefined;
  authUrl?: string | undefined;
  siteUrl?: string | undefined;
}

/**
 * Nom du cookie pour des conditions données. Pur, donc testable.
 *
 * Le protocole de la REQUÊTE l'emporte : c'est la seule source qu'Auth.js
 * consulte. Les variables d'environnement ne servent que de repli, pour le
 * cas — rare mais réel — d'un proxy qui n'annonce pas le protocole.
 */
export function nomDuCookiePour({
  protocoleTransmis,
  authUrl,
  siteUrl,
}: ConditionsCookie): string {
  const premier = protocoleTransmis?.split(',')[0]?.trim().toLowerCase();

  const securise =
    premier === 'https' ||
    (premier === undefined &&
      ((authUrl ?? '').startsWith('https://') || (siteUrl ?? '').startsWith('https://')));

  return securise ? `${PREFIXE_SECURISE}${NOM_COOKIE}` : NOM_COOKIE;
}

/** Nom du cookie pour la requête en cours. */
export async function nomDuCookie(): Promise<string> {
  const entetes = await headers();

  return nomDuCookiePour({
    protocoleTransmis: entetes.get('x-forwarded-proto') ?? undefined,
    authUrl: process.env.AUTH_URL,
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
  });
}

/**
 * Ouvre une session pour cet utilisateur et pose le cookie.
 *
 */
export async function ouvrirSession(userId: string): Promise<void> {
  const expiration = new Date(Date.now() + DUREE_SESSION_MS);
  const jeton = await creerSession(userId, expiration);

  const nom = await nomDuCookie();
  const boite = await cookies();

  boite.set(nom, jeton, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: nom.startsWith(PREFIXE_SECURISE),
    expires: expiration,
  });
}

/**
 * Ferme la session courante : la ligne PUIS le cookie.
 *
 * Dans cet ordre. Retirer le cookie d'abord laisserait, en cas d'erreur
 * ensuite, une session valide en base dont plus personne ne connaît le
 * jeton — sauf celui qui l'aurait intercepté.
 */
export async function fermerSession(): Promise<void> {
  const nom = await nomDuCookie();
  const boite = await cookies();
  const jeton = boite.get(nom)?.value;

  if (jeton) await supprimerSession(jeton);
  boite.delete(nom);
}
