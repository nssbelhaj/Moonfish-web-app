import { CONSENT_VERSION } from '@/lib/auth/consent';
import { hacher, verifier } from '@/lib/auth/password';
import {
  creerCompteAvecMotDePasse,
  echecDeConnexion,
  identifiantsDe,
  succesDeConnexion,
} from '@/lib/providers/mysql/comptes';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  Ouvrir un compte, vérifier des identifiants — UNE seule fois
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ── Pourquoi ce module a été extrait ─────────────────────────────────────
 *
 * Ces deux opérations vivaient uniquement dans `actions-compte.ts`, mêlées au
 * transport d'un formulaire HTML : lecture de `FormData`, pose d'un cookie,
 * `revalidatePath`. L'API mobile a besoin des MÊMES règles avec un autre
 * transport — du JSON et un jeton porteur — et les recopier aurait créé une
 * seconde implémentation de la connexion.
 *
 * C'est exactement le raisonnement qui a fait exister cette API : deux
 * implémentations d'une règle finissent toujours par diverger. Pour le score,
 * la divergence afficherait « Bon » là où le site dit « Danger ». Ici elle
 * serait plus discrète et plus grave : un verrou de compte appliqué d'un côté
 * et pas de l'autre, une comparaison à temps constant oubliée sur le chemin
 * mobile, un message qui distingue « adresse inconnue » de « mot de passe
 * faux » sur une route et pas sur l'autre.
 *
 * Ce module ne connaît donc NI formulaire, NI cookie, NI requête. Il prend
 * des valeurs déjà validées et rend un verdict. Les deux transports posent
 * ensuite la session comme ils savent le faire.
 */

/* ═══════════════════════════════════════════════════════════════════════════
   Vérification d'identifiants
   ═══════════════════════════════════════════════════════════════════════════ */

export type VerdictIdentifiants =
  | { ok: true; userId: string }
  /** Adresse inconnue OU mot de passe faux. Les deux, indistinctement. */
  | { ok: false; raison: 'refus' }
  | { ok: false; raison: 'verrouille'; jusqua: number };

/**
 * Empreinte d'un mot de passe que personne ne connaît.
 *
 * Elle ne sert qu'à faire passer le même temps de calcul quand l'adresse est
 * inconnue. Sans elle, la réponse reviendrait instantanément pour une adresse
 * inconnue et après une centaine de millisecondes pour une adresse connue —
 * et ce délai suffirait à distinguer les deux, ce que le message unique
 * refuse justement de faire. Le formulaire de connexion deviendrait un outil
 * de vérification d'adresses.
 *
 * Elle est constante, donc calculée une fois, et exportée pour que le test
 * puisse vérifier qu'elle n'ouvre aucune session.
 */
export const EMPREINTE_FACTICE =
  'scrypt$65536$8$1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

/**
 * Le mot de passe correspond-il à cette adresse ?
 *
 * Met à jour le compteur d'échecs et le verrou de compte au passage : ce sont
 * des conséquences de la vérification, et les laisser à l'appelant reviendrait
 * à pouvoir les oublier — ce qui rendrait le verrou inopérant sur le chemin
 * qui l'oublierait.
 */
export async function verifierIdentifiants(
  email: string,
  motDePasse: string,
): Promise<VerdictIdentifiants> {
  const identifiants = await identifiantsDe(email);

  if (identifiants === null) {
    await verifier(motDePasse, EMPREINTE_FACTICE);
    return { ok: false, raison: 'refus' };
  }

  if (identifiants.lockedUntil !== null) {
    const jusqua = new Date(identifiants.lockedUntil).getTime();
    if (jusqua > Date.now()) return { ok: false, raison: 'verrouille', jusqua };
  }

  if (!(await verifier(motDePasse, identifiants.passwordHash))) {
    await echecDeConnexion(identifiants.userId);
    return { ok: false, raison: 'refus' };
  }

  await succesDeConnexion(identifiants.userId);
  return { ok: true, userId: identifiants.userId };
}

/* ═══════════════════════════════════════════════════════════════════════════
   Ouverture de compte
   ═══════════════════════════════════════════════════════════════════════════ */

export type VerdictCreation =
  | { ok: true; userId: string; displayName: string }
  | { ok: false; raison: 'adresse-prise' | 'erreur' };

/**
 * Crée un compte à partir d'une inscription déjà validée par Zod.
 *
 * Le nom affiché part du PRÉNOM SEUL. C'est lui qui apparaît sous un avis ou
 * une prise : y mettre « Prénom NOM » publierait le nom de famille de
 * quelqu'un qui n'a jamais demandé cela. Il reste modifiable sur la page du
 * compte. Cette règle est ici, et non dans chaque appelant, pour qu'un nouveau
 * chemin d'inscription ne puisse pas la perdre en route.
 */
export async function creerCompte(donnees: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  birthDate: string;
}): Promise<VerdictCreation> {
  const resultat = await creerCompteAvecMotDePasse({
    email: donnees.email,
    passwordHash: await hacher(donnees.password),
    firstName: donnees.firstName,
    lastName: donnees.lastName,
    birthDate: donnees.birthDate,
    displayName: donnees.firstName,
    consentVersion: CONSENT_VERSION,
  });

  return resultat.ok
    ? { ok: true, userId: resultat.userId, displayName: donnees.firstName }
    : resultat;
}
