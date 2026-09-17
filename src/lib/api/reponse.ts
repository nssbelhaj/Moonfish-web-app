import { ZodError } from 'zod';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  L'enveloppe de toutes les réponses de l'API publique
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ── Pourquoi une enveloppe, et pas le contenu nu ─────────────────────────
 *
 * Une application installée survit à son serveur : elle est sur le téléphone
 * de quelqu'un pendant des mois, et elle rencontrera des versions de l'API
 * que son auteur n'a pas vues. Une forme de réponse CONSTANTE — `ok` d'abord,
 * puis les données ou le motif du refus — lui permet de traiter l'échec au
 * même endroit, quelle que soit la route. Le contenu nu obligerait chaque
 * appel à deviner si ce qu'il reçoit est une donnée ou une erreur.
 *
 * ── Le `charset` est écrit à la main, et ce n'est pas du zèle ────────────
 *
 * `NextResponse.json()` pose `application/json` sans jeu de caractères. Les
 * messages de ce projet sont en français et portent des accents, des espaces
 * insécables et des apostrophes typographiques ; un client qui suppose du
 * latin-1 faute de déclaration affiche « Prévision indisponible » en
 * charabia. Le cahier des charges de l'API l'exige explicitement, on ne
 * s'en remet donc pas à un défaut.
 */

/** Version de contrat. On ne casse jamais une route : on en publie une autre. */
export const VERSION_API = 1;

const TYPE_JSON = 'application/json; charset=utf-8';

/**
 * Motifs de refus, stables et lisibles par la machine.
 *
 * L'application affiche `message` à la personne ; elle réagit sur `code`.
 * Les deux sont nécessaires : traduire un message pour décider quoi faire
 * reviendrait à comparer des phrases, qui changent.
 */
export type CodeErreur =
  | 'saisie-invalide'
  | 'non-authentifie'
  | 'introuvable'
  | 'trop-de-demandes'
  | 'comptes-fermes'
  | 'indisponible';

export interface Refus {
  ok: false;
  code: CodeErreur;
  message: string;
  /** Champ fautif, quand la saisie est en cause : le formulaire peut le désigner. */
  champ?: string;
}

export type Enveloppe<T> = { ok: true; donnees: T } | Refus;

function reponse(corps: unknown, statut: number, entetes?: HeadersInit): Response {
  return new Response(JSON.stringify(corps), {
    status: statut,
    headers: {
      'content-type': TYPE_JSON,
      'x-luna-api': String(VERSION_API),
      ...entetes,
    },
  });
}

export function succes<T>(donnees: T, entetes?: HeadersInit): Response {
  return reponse({ ok: true, donnees } satisfies Enveloppe<T>, 200, entetes);
}

/**
 * Un refus, avec son statut HTTP.
 *
 * Les messages nomment la CAUSE et le REMÈDE, comme partout ailleurs dans ce
 * projet : « Session expirée » seul laisse la personne devant un écran qui ne
 * lui dit pas quoi faire.
 */
export function refus(
  statut: number,
  code: CodeErreur,
  message: string,
  champ?: string,
  entetes?: HeadersInit,
): Response {
  return reponse(
    { ok: false, code, message, ...(champ === undefined ? {} : { champ }) } satisfies Refus,
    statut,
    entetes,
  );
}

export const NON_AUTHENTIFIE = () =>
  refus(
    401,
    'non-authentifie',
    'Votre session a expiré ou n’a jamais été ouverte. Connectez-vous à nouveau : votre saisie n’est pas perdue.',
  );

export const COMPTES_FERMES = () =>
  refus(
    503,
    'comptes-fermes',
    'Les comptes ne sont pas ouverts sur ce déploiement. Rien à réessayer de votre côté : la base de données n’est pas configurée sur le serveur.',
  );

export const INTROUVABLE = (quoi: string) =>
  refus(404, 'introuvable', `${quoi} est introuvable. Vérifiez l’adresse demandée.`);

/**
 * Premier défaut signalé par Zod, avec le champ qu'il désigne.
 *
 * Un seul, pas la liste : l'application met le doigt sur un champ à la fois,
 * et une liste de sept messages sur un écran de téléphone ne se lit pas. Les
 * messages viennent des schémas, qui sont déjà écrits en français.
 */
export function saisieInvalide(erreur: ZodError): Response {
  const probleme = erreur.issues[0];
  const champ = probleme?.path[0];

  return refus(
    422,
    'saisie-invalide',
    probleme?.message ?? 'Saisie invalide.',
    typeof champ === 'string' ? champ : undefined,
  );
}

/**
 * Refus pour excès de demandes.
 *
 * `Retry-After` est en SECONDES et voyage dans l'en-tête, pas seulement dans
 * la phrase : c'est ce qui permet à l'application de se taire d'elle-même au
 * lieu de reboucler, et à la personne de ne pas voir un message d'erreur
 * clignoter à chaque tentative automatique.
 */
export function tropDeDemandes(message: string, resetAt: number): Response {
  const secondes = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
  return refus(429, 'trop-de-demandes', message, undefined, {
    'retry-after': String(secondes),
  });
}

/**
 * Corps JSON d'une requête, ou `null` s'il est illisible.
 *
 * Un corps vide, tronqué ou qui n'est pas du JSON se produit pour de vrai :
 * une coupure de réseau au milieu d'un envoi depuis un téléphone en est la
 * cause la plus banale. Le cas est donc traité, pas laissé lever une 500 qui
 * ferait croire à une panne du serveur.
 */
export async function corpsJson(requete: Request): Promise<unknown | null> {
  try {
    return await requete.json();
  } catch {
    return null;
  }
}

export const CORPS_ILLISIBLE = () =>
  refus(
    400,
    'saisie-invalide',
    'La requête n’a pas pu être lue — elle est incomplète ou mal formée. Vérifiez votre connexion et renvoyez-la.',
  );

/**
 * Traduit l'échec d'un dépôt de contributions en réponse HTTP.
 *
 * Le dépôt rend déjà un motif ET un message en français ; les recopier route
 * par route aurait produit quatre variantes du même refus, dont trois
 * finiraient par diverger du message réel. Le statut, lui, doit être dit ici :
 * une saisie refusée (422) et une base en panne (503) ne se réessaient pas de
 * la même façon, et c'est précisément ce que le code HTTP apprend au client.
 */
export function refusDeContribution(echec: {
  reason: 'not-available' | 'not-authenticated' | 'invalid' | 'storage-error';
  message: string;
}): Response {
  switch (echec.reason) {
    case 'not-available':
      return refus(503, 'comptes-fermes', echec.message);
    case 'not-authenticated':
      return refus(401, 'non-authentifie', echec.message);
    case 'invalid':
      return refus(422, 'saisie-invalide', echec.message);
    case 'storage-error':
      return refus(503, 'indisponible', echec.message);
  }
}
