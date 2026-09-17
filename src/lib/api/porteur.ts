import { databaseEnabled } from '@/lib/db/mysql';
import { creerSession, supprimerSession, utilisateurDeSession } from '@/lib/providers/mysql/comptes';
import { DUREE_SESSION_MS } from '@/lib/auth/session-cookie';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  Le jeton porteur, et pourquoi il n'est PAS un second système
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Le site ouvre déjà ses sessions à la main, dans la table `sessions`, et les
 * relit avec `utilisateurDeSession` (voir `lib/auth/session-cookie.ts` et
 * `lib/auth/session.ts`). Le cookie n'est que le TRANSPORT de ce jeton.
 *
 * L'application mobile n'a pas de cookie : elle range le même jeton dans le
 * trousseau du téléphone et l'envoie dans `Authorization: Bearer`. Le serveur
 * fait ensuite exactement ce qu'il fait pour le web — un `select` sur la même
 * table, avec la même condition d'expiration.
 *
 * Ce que cette symétrie garantit, et qu'un jeton auto-porté (JWT) aurait
 * perdu : une déconnexion, depuis le téléphone OU depuis le navigateur, prend
 * effet à la requête SUIVANTE, partout. C'est la propriété qui a justifié de
 * mettre les sessions en base plutôt que dans un jeton signé ; l'API n'a pas
 * le droit de la reprendre.
 *
 * ── Le schéma est comparé sans tenir compte de la casse ──────────────────
 *
 * La RFC 7235 définit le schéma d'authentification comme insensible à la
 * casse, et les bibliothèques HTTP des téléphones n'écrivent pas toutes
 * « Bearer » avec la même majuscule. Comparer la chaîne telle quelle
 * produirait un 401 que personne ne saurait expliquer.
 */

export interface PorteurValide {
  id: string;
  email: string | null;
  /** Le jeton lui-même, nécessaire pour le révoquer à la déconnexion. */
  jeton: string;
}

/** Le jeton d'une requête, sans le vérifier. `null` si l'en-tête est absent ou mal formé. */
export function jetonDe(requete: Request): string | null {
  const entete = requete.headers.get('authorization');
  if (entete === null) return null;

  const separateur = entete.indexOf(' ');
  if (separateur < 0) return null;

  const schema = entete.slice(0, separateur).toLowerCase();
  if (schema !== 'bearer') return null;

  const jeton = entete.slice(separateur + 1).trim();
  return jeton.length === 0 ? null : jeton;
}

/**
 * L'utilisateur d'une requête, ou `null`.
 *
 * Aucune distinction n'est faite entre « pas de jeton », « jeton inventé » et
 * « jeton expiré » : les trois rendent `null` et l'appelant répond la même
 * chose. Les séparer dirait à qui essaie des jetons au hasard lesquels ont
 * existé.
 */
export async function porteurDe(requete: Request): Promise<PorteurValide | null> {
  if (!databaseEnabled()) return null;

  const jeton = jetonDe(requete);
  if (jeton === null) return null;

  try {
    const utilisateur = await utilisateurDeSession(jeton);
    return utilisateur === null ? null : { ...utilisateur, jeton };
  } catch (erreur) {
    // Une base qui ne répond pas est une panne, pas un refus d'identité : on
    // la journalise plutôt que de la faire passer pour un jeton invalide.
    console.error('[api] lecture de session impossible', erreur);
    return null;
  }
}

/**
 * Adresse de l'appelant, lue sur la requête.
 *
 * `x-forwarded-for` est falsifiable — ce qu'elle protège, c'est le bruit et
 * les scripts naïfs. Les budgets par compte et par adresse e-mail existent
 * précisément parce que celui-ci ne suffit pas. Elle est lue sur la requête
 * plutôt que par `headers()` pour que les routes qui n'en ont pas besoin
 * puissent rester servies depuis le cache.
 *
 * Un détail qui compte pour le mobile : derrière le NAT d'un opérateur,
 * des milliers d'abonnés partagent une adresse. Un budget par IP y est donc
 * beaucoup plus grossier que sur le web, et c'est pourquoi les routes de
 * compte comptent par UTILISATEUR dès qu'un jeton valide est présent.
 */
export function ipDeRequete(requete: Request): string {
  const transmise = requete.headers.get('x-forwarded-for');
  if (transmise) return transmise.split(',')[0]?.trim() || 'inconnu';
  return requete.headers.get('x-real-ip') ?? 'inconnu';
}

/* ═══════════════════════════════════════════════════════════════════════════
   Ouvrir et fermer une session pour un porteur
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Ouvre une session et rend le jeton.
 *
 * ── La durée est celle du web, et c'est un choix ─────────────────────────
 *
 * `DUREE_SESSION_MS` est importée de `session-cookie.ts` plutôt que recopiée :
 * une application qui déconnecte au bout de trente jours pendant que le
 * navigateur en accorde soixante serait un écart que personne ne remarquerait
 * avant de le subir. Le jour où l'on voudra une durée propre au mobile — c'est
 * défendable, on ne reconnecte pas volontiers un téléphone au bord de l'eau —
 * ce sera une décision écrite ici, pas une dérive.
 *
 * ── Ce que l'appelant DOIT faire du jeton ────────────────────────────────
 *
 * Le ranger dans `expo-secure-store`, c'est-à-dire le trousseau du système,
 * et nulle part ailleurs. Il vaut preuve d'identité à lui seul : dans
 * `AsyncStorage` il serait lisible par n'importe quelle sauvegarde de
 * l'appareil.
 */
export async function ouvrirSessionPorteur(
  userId: string,
): Promise<{ jeton: string; expiration: string }> {
  const expiration = new Date(Date.now() + DUREE_SESSION_MS);
  const jeton = await creerSession(userId, expiration);

  return { jeton, expiration: expiration.toISOString() };
}

/**
 * Ferme la session portée par ce jeton.
 *
 * La ligne disparaît de la table : la déconnexion prend effet à la requête
 * suivante, sur le téléphone comme dans le navigateur. C'est la propriété que
 * les sessions en base ont été choisies pour donner, et qu'un jeton signé
 * aurait perdue — il resterait valable jusqu'à son expiration, y compris
 * après un « supprimez mes données ».
 */
export async function fermerSessionPorteur(jeton: string): Promise<void> {
  await supprimerSession(jeton);
}
