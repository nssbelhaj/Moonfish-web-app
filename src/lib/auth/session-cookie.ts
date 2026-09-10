import { cookies } from 'next/headers';

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
 * Ce module dépend d'un détail interne d'Auth.js : le nom du cookie. Il est
 * défini dans `@auth/core/lib/utils/cookie.js`, qui n'est pas une interface
 * publique. `session-cookie.test.ts` relit ce fichier et échoue si le nom y
 * change — une montée de version qui déplacerait le cookie déconnecterait
 * sinon tout le monde en silence.
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
export function nomDuCookie(env: Readonly<Record<string, string | undefined>> = process.env): string {
  const url = env['AUTH_URL'] ?? env['NEXTAUTH_URL'] ?? env['NEXT_PUBLIC_SITE_URL'] ?? '';
  const securise = url.startsWith('https://');

  return securise ? `${PREFIXE_SECURISE}${NOM_COOKIE}` : NOM_COOKIE;
}

/**
 * Ouvre une session pour cet utilisateur et pose le cookie.
 *
 */
export async function ouvrirSession(userId: string): Promise<void> {
  const expiration = new Date(Date.now() + DUREE_SESSION_MS);
  const jeton = await creerSession(userId, expiration);

  const nom = nomDuCookie();
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
  const nom = nomDuCookie();
  const boite = await cookies();
  const jeton = boite.get(nom)?.value;

  if (jeton) await supprimerSession(jeton);
  boite.delete(nom);
}
