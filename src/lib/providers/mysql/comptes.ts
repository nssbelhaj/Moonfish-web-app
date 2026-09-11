import { createHash, randomBytes, randomUUID } from 'node:crypto';

import { execute, query, queryOne, toIso, toMysqlDateTime } from '@/lib/db/mysql';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  Comptes classiques : création, vérification, réinitialisation
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Tout le SQL des comptes vit ici, dans le dossier autorisé par
 * `proprietaire.test.ts`. Les actions serveur ne composent jamais de requête.
 *
 * Ce module ne connaît AUCUN mot de passe en clair : il reçoit et rend des
 * empreintes. Le hachage vit dans `@/lib/auth/password`, sa vérification dans
 * l'action. Un module qui écrit en base et qui saurait hacher finirait par
 * journaliser ce qu'il ne faut pas.
 */

export interface Identifiants {
  userId: string;
  passwordHash: string;
  failedCount: number;
  lockedUntil: string | null;
}

/** Verrouillage du compte après des échecs répétés, quelle que soit l'origine. */
export const ECHECS_AVANT_VERROU = 8;
export const DUREE_VERROU_MS = 15 * 60_000;

/** Validité d'un lien de réinitialisation. Court : il donne accès au compte. */
export const VALIDITE_REINITIALISATION_MS = 60 * 60_000;

function empreinteJeton(jeton: string): string {
  return createHash('sha256').update(jeton).digest('hex');
}

/**
 * L'adresse est-elle déjà prise ?
 *
 * Sert au message d'inscription, jamais à un formulaire public : répondre
 * « cette adresse existe » à n'importe qui transformerait la page en outil de
 * vérification d'adresses.
 */
export async function adresseUtilisee(email: string): Promise<boolean> {
  const ligne = await queryOne<{ id: string }>('select id from users where email = ?', [email]);
  return ligne !== null;
}

/**
 * Crée le compte, ses identifiants et son profil.
 *
 * Les trois écritures vont ensemble : un compte sans profil ne pourrait rien
 * publier, un compte sans identifiants ne pourrait pas se connecter. En cas
 * d'échec au milieu, on retire ce qui a été créé plutôt que de laisser une
 * moitié de compte que personne ne saura réparer.
 */
export async function creerCompteAvecMotDePasse(input: {
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  displayName: string;
  consentVersion: string;
}): Promise<{ ok: true; userId: string } | { ok: false; raison: 'adresse-prise' | 'erreur' }> {
  if (await adresseUtilisee(input.email)) return { ok: false, raison: 'adresse-prise' };

  const userId = randomUUID();

  try {
    await execute('insert into users (id, name, email) values (?, ?, ?)', [
      userId,
      input.displayName,
      input.email,
    ]);
    await execute('insert into user_credentials (user_id, password_hash) values (?, ?)', [
      userId,
      input.passwordHash,
    ]);
    await execute(
      'insert into profiles (user_id, display_name, consent_version, first_name, last_name, birth_date) values (?, ?, ?, ?, ?, ?)',
      [userId, input.displayName, input.consentVersion, input.firstName, input.lastName, input.birthDate],
    );

    return { ok: true, userId };
  } catch (error) {
    /*
      Deux inscriptions simultanées sur la même adresse passent toutes deux le
      contrôle d'unicité ci-dessus ; c'est l'index unique de `users.email` qui
      tranche. On rend alors le même message que le contrôle, plutôt qu'une
      erreur technique.
    */
    const code = (error as { code?: string }).code;
    await execute('delete from users where id = ?', [userId]).catch(() => undefined);

    if (code === 'ER_DUP_ENTRY') return { ok: false, raison: 'adresse-prise' };

    console.error('[comptes] création impossible', error);
    return { ok: false, raison: 'erreur' };
  }
}

export async function identifiantsDe(email: string): Promise<Identifiants | null> {
  const ligne = await queryOne<{
    user_id: string;
    password_hash: string;
    failed_count: number;
    locked_until: string | Date | null;
  }>(
    'select c.user_id, c.password_hash, c.failed_count, c.locked_until ' +
      'from user_credentials c join users u on u.id = c.user_id where u.email = ?',
    [email],
  );

  if (ligne === null) return null;

  return {
    userId: ligne.user_id,
    passwordHash: ligne.password_hash,
    failedCount: Number(ligne.failed_count),
    lockedUntil: toIso(ligne.locked_until),
  };
}

/**
 * Enregistre un échec, et verrouille au-delà du seuil.
 *
 * Le limiteur d'appels protège déjà par adresse et par IP. Celui-ci protège
 * le COMPTE : mille adresses IP différentes essayant le même compte
 * passeraient le premier sans jamais toucher au second.
 */
export async function echecDeConnexion(userId: string): Promise<void> {
  /*
    ── Une subtilité de MySQL, qui coûtait un essai ──────────────────────────

    Dans un `update`, les affectations sont évaluées de GAUCHE À DROITE, et
    celles de droite voient déjà la NOUVELLE valeur des colonnes de gauche.
    La seconde clause lit donc `failed_count` DÉJÀ incrémenté.

    La première version écrivait `if(failed_count + 1 >= ?, …)` : elle
    comptait l'incrément deux fois et verrouillait au septième échec en
    annonçant le huitième. Mesuré par le test d'intégration ; invisible
    autrement.
  */
  await execute(
    'update user_credentials set failed_count = failed_count + 1, ' +
      'locked_until = if(failed_count >= ?, ?, locked_until) where user_id = ?',
    [ECHECS_AVANT_VERROU, toMysqlDateTime(new Date(Date.now() + DUREE_VERROU_MS)), userId],
  );
}

/** Une connexion réussie efface l'ardoise : le compteur ne vise pas à punir. */
export async function succesDeConnexion(userId: string): Promise<void> {
  await execute(
    'update user_credentials set failed_count = 0, locked_until = null where user_id = ?',
    [userId],
  );
}

export async function remplacerMotDePasse(userId: string, passwordHash: string): Promise<void> {
  await execute(
    'update user_credentials set password_hash = ?, failed_count = 0, locked_until = null where user_id = ?',
    [passwordHash, userId],
  );

  /*
    Toutes les sessions tombent. Changer son mot de passe est ce qu'on fait
    quand on craint que quelqu'un d'autre soit entré : laisser ses sessions
    ouvertes viderait le geste de son sens.
  */
  await execute('delete from sessions where userId = ?', [userId]);
}

/**
 * Ouvre une réinitialisation et rend le jeton EN CLAIR, une seule fois.
 *
 * Seule son empreinte est stockée : une fuite de la base ne donne pas la main
 * sur les comptes. Le jeton n'existe que dans le courriel.
 */
export async function ouvrirReinitialisation(userId: string): Promise<string> {
  const jeton = randomBytes(32).toString('base64url');

  // Les demandes précédentes tombent : un seul lien valide à la fois.
  await execute('delete from password_resets where user_id = ?', [userId]);
  await execute('insert into password_resets (token_hash, user_id, expires) values (?, ?, ?)', [
    empreinteJeton(jeton),
    userId,
    toMysqlDateTime(new Date(Date.now() + VALIDITE_REINITIALISATION_MS)),
  ]);

  return jeton;
}

/**
 * Consomme un jeton de réinitialisation.
 *
 * La consommation est ATOMIQUE : `update … where used_at is null` ne touche
 * qu'une ligne, même si deux requêtes arrivent ensemble. Un `select` suivi
 * d'un `update` laisserait un même lien servir deux fois.
 */
export async function consommerReinitialisation(jeton: string): Promise<string | null> {
  const touchees = await execute(
    'update password_resets set used_at = now(3) where token_hash = ? and used_at is null and expires > now(3)',
    [empreinteJeton(jeton)],
  );
  if (touchees === 0) return null;

  const ligne = await queryOne<{ user_id: string }>(
    'select user_id from password_resets where token_hash = ?',
    [empreinteJeton(jeton)],
  );

  return ligne?.user_id ?? null;
}

/** Ménage des demandes expirées. Appelé par la tâche d'entretien. */
export async function purgerReinitialisations(): Promise<number> {
  return execute('delete from password_resets where expires < now(3)');
}

/** Le compte a-t-il un mot de passe ? Un compte créé par lien n'en a pas. */
export async function aUnMotDePasse(userId: string): Promise<boolean> {
  const lignes = await query<{ user_id: string }>(
    'select user_id from user_credentials where user_id = ?',
    [userId],
  );
  return lignes.length > 0;
}

/**
 * Crée une ligne de session et rend son jeton.
 *
 * Écrit dans LA MÊME table que l'adaptateur d'Auth.js : la bibliothèque
 * relit ensuite la session sans savoir qui l'a créée — `getSessionAndUser`
 * ne fait qu'un `select` sur `sessionToken`.
 *
 * Le jeton fait 32 octets de hasard : c'est lui, et lui seul, qui vaut
 * preuve d'identité pendant toute la durée de la session.
 */
export async function creerSession(userId: string, expiration: Date): Promise<string> {
  const jeton = randomBytes(32).toString('base64url');

  await execute('insert into sessions (id, sessionToken, userId, expires) values (?, ?, ?, ?)', [
    randomUUID(),
    jeton,
    userId,
    toMysqlDateTime(expiration),
  ]);

  return jeton;
}

/** Supprime une session par son jeton. */
export async function supprimerSession(jeton: string): Promise<void> {
  await execute('delete from sessions where sessionToken = ?', [jeton]);
}

/**
 * Le compte le plus ancien du site.
 *
 * ── Pourquoi « le premier inscrit » plutôt qu'une variable ───────────────
 *
 * Désigner le propriétaire par une variable d'environnement suppose qu'on
 * sache la retrouver. Six échanges ont buté là-dessus pour `CRON_SECRET` :
 * la chercher, la reconnaître, la recopier sans se tromper. Le premier compte
 * créé, lui, ne demande rien — c'est forcément celui de la personne qui a
 * déployé le site, puisqu'à ce moment-là personne d'autre n'en connaît
 * l'adresse.
 *
 * Ce que cette qualité permet est volontairement ÉTROIT : lire l'état de la
 * configuration. Aucune action, aucune donnée d'autrui, aucune suppression.
 * Le pire qu'un usurpateur y gagnerait serait de savoir quelles variables
 * d'environnement sont définies — pas leurs valeurs.
 *
 * L'égalité de date est départagée par l'identifiant, pour que la réponse
 * soit stable : deux comptes créés dans la même milliseconde ne doivent pas
 * se voler la place d'une requête à l'autre.
 */
export async function premierCompte(): Promise<string | null> {
  const ligne = await queryOne<{ id: string }>(
    'select id from users order by created_at asc, id asc limit 1',
  );
  return ligne?.id ?? null;
}

/**
 * Utilisateur d'une session valide, par son jeton.
 *
 * Lecture DIRECTE, sans passer par Auth.js. Elle sert de second chemin quand
 * la bibliothèque refuse de servir la requête — voir `currentUser()`.
 *
 * `expires > now(3)` est dans la requête, pas dans le code appelant : une
 * session expirée ne doit jamais remonter, même si l'appelant oublie de
 * vérifier.
 */
export async function utilisateurDeSession(
  jeton: string,
): Promise<{ id: string; email: string | null } | null> {
  const ligne = await queryOne<{ id: string; email: string | null }>(
    'select u.id, u.email from sessions s join users u on u.id = s.userId ' +
      'where s.sessionToken = ? and s.expires > now(3)',
    [jeton],
  );

  return ligne ?? null;
}
