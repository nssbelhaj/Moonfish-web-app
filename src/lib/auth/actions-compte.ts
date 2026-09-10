'use server';

import { revalidatePath } from 'next/cache';

import { CONSENT_VERSION } from '@/lib/auth/consent';
import {
  connexionSchema,
  inscriptionSchema,
  motDePasseOublieSchema,
  nouveauMotDePasseSchema,
} from '@/data/schemas-compte';
import { accountsEnabled, magicLinkEnabled } from '@/lib/auth/config';
import { hacher, verifier } from '@/lib/auth/password';
import { fermerSession, ouvrirSession } from '@/lib/auth/session-cookie';
import { currentUser } from '@/lib/auth/session';
import { BUDGETS, consommer, delaiLisible, ipAppelante, rembourser } from '@/lib/limites';
import {
  consommerReinitialisation,
  creerCompteAvecMotDePasse,
  echecDeConnexion,
  identifiantsDe,
  ouvrirReinitialisation,
  remplacerMotDePasse,
  succesDeConnexion,
} from '@/lib/providers/mysql/comptes';
import { absoluteUrl } from '@/lib/routes';

export interface EtatCompte {
  ok: boolean;
  message: string;
  /** Champ fautif, pour que le formulaire puisse le désigner. */
  champ?: string;
}

const FERMES: EtatCompte = {
  ok: false,
  message: 'Les comptes ne sont pas ouverts sur ce déploiement.',
};

const COMPTEUR_EN_PANNE: EtatCompte = {
  ok: false,
  message:
    'Le compteur de sécurité ne répond pas — la base est joignable mais incomplète. Ce n’est ni votre adresse ni un excès de demandes : les migrations n’ont probablement pas été appliquées au déploiement.',
};

/** Premier problème signalé par Zod, avec le champ qu'il désigne. */
function premierDefaut(erreur: { issues: { message: string; path: (string | number)[] }[] }): EtatCompte {
  const issue = erreur.issues[0];
  const champ = issue?.path[0];

  return {
    ok: false,
    message: issue?.message ?? 'Saisie invalide.',
    ...(typeof champ === 'string' ? { champ } : {}),
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   Inscription
   ═══════════════════════════════════════════════════════════════════════════ */

export async function inscrire(
  _precedent: EtatCompte | null,
  formData: FormData,
): Promise<EtatCompte> {
  if (!accountsEnabled()) return FERMES;

  const analyse = inscriptionSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    passwordConfirm: formData.get('password_confirm'),
    firstName: formData.get('first_name'),
    lastName: formData.get('last_name'),
    birthDate: formData.get('birth_date'),
    consentement: formData.get('consentement'),
  });

  if (!analyse.success) return premierDefaut(analyse.error);

  const budget = await consommer(BUDGETS.inscriptionIp, await ipAppelante());
  if (budget.panne) return COMPTEUR_EN_PANNE;
  if (!budget.allowed) {
    return {
      ok: false,
      message: `Trop d’inscriptions depuis cet accès. Réessayez dans ${delaiLisible(budget.resetAt)}.`,
    };
  }

  const { email, password, firstName, lastName, birthDate } = analyse.data;

  /*
    Le nom affiché part du prénom seul. C'est lui qui apparaît sous un avis ou
    une prise : y mettre « Prénom NOM » publierait le nom de famille de
    quelqu'un qui n'a jamais demandé cela. Il reste modifiable sur la page du
    compte.
  */
  const resultat = await creerCompteAvecMotDePasse({
    email,
    passwordHash: await hacher(password),
    firstName,
    lastName,
    birthDate,
    displayName: firstName,
    consentVersion: CONSENT_VERSION,
  });

  if (!resultat.ok) {
    if (resultat.raison === 'adresse-prise') {
      /*
        Ici, on DIT que l'adresse est prise. Le formulaire de connexion, lui,
        ne le dira jamais.

        La différence est assumée : sans ce message, quelqu'un dont l'adresse
        est déjà inscrite se heurterait à un refus incompréhensible. Et il
        n'apprend rien qu'une tentative de connexion ne lui apprendrait — sauf
        que celle-là échoue faute de mot de passe.
      */
      return {
        ok: false,
        champ: 'email',
        message: 'Un compte existe déjà avec cette adresse. Connectez-vous, ou demandez un nouveau mot de passe.',
      };
    }

    await rembourser(BUDGETS.inscriptionIp, await ipAppelante());
    return { ok: false, message: 'La création du compte a échoué. Réessayez dans un instant.' };
  }

  await ouvrirSession(resultat.userId);
  revalidatePath('/compte');

  return { ok: true, message: `Bienvenue, ${firstName}. Votre compte est créé.` };
}

/* ═══════════════════════════════════════════════════════════════════════════
   Connexion
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Réponse unique à tout échec de connexion.
 *
 * « Adresse inconnue » et « mot de passe faux » se répondent EXACTEMENT
 * pareil. Les distinguer transformerait le formulaire en outil de
 * vérification d'adresses : n'importe qui saurait qui a un compte ici.
 */
const REFUS: EtatCompte = {
  ok: false,
  message: 'Adresse e-mail ou mot de passe incorrect.',
};

export async function seConnecter(
  _precedent: EtatCompte | null,
  formData: FormData,
): Promise<EtatCompte> {
  if (!accountsEnabled()) return FERMES;

  const analyse = connexionSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!analyse.success) return premierDefaut(analyse.error);

  const ip = await ipAppelante();
  const parIp = await consommer(BUDGETS.connexionMotDePasseIp, ip);
  if (parIp.panne) return COMPTEUR_EN_PANNE;
  if (!parIp.allowed) {
    return {
      ok: false,
      message: `Trop de tentatives depuis cet accès. Réessayez dans ${delaiLisible(parIp.resetAt)}.`,
    };
  }

  const identifiants = await identifiantsDe(analyse.data.email);

  /*
    Aucune adresse trouvée : on vérifie quand même un mot de passe, contre une
    empreinte factice. Sans cela, la réponse reviendrait instantanément pour
    une adresse inconnue et après cent millisecondes pour une adresse connue —
    et ce délai suffirait à distinguer les deux, ce que le message refuse
    justement de faire.
  */
  if (identifiants === null) {
    await verifier(analyse.data.password, EMPREINTE_FACTICE);
    return REFUS;
  }

  if (identifiants.lockedUntil !== null && new Date(identifiants.lockedUntil) > new Date()) {
    return {
      ok: false,
      message: `Ce compte est temporairement bloqué après plusieurs tentatives. Réessayez dans ${delaiLisible(new Date(identifiants.lockedUntil).getTime())}.`,
    };
  }

  if (!(await verifier(analyse.data.password, identifiants.passwordHash))) {
    await echecDeConnexion(identifiants.userId);
    return REFUS;
  }

  await succesDeConnexion(identifiants.userId);
  await ouvrirSession(identifiants.userId);
  revalidatePath('/compte');

  return { ok: true, message: 'Vous êtes connecté.' };
}

/**
 * Empreinte d'un mot de passe que personne ne connaît.
 *
 * Elle ne sert qu'à faire passer le même temps de calcul quand l'adresse est
 * inconnue. Elle est constante, donc calculée une fois.
 */
const EMPREINTE_FACTICE =
  'scrypt$65536$8$1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

/* ═══════════════════════════════════════════════════════════════════════════
   Déconnexion
   ═══════════════════════════════════════════════════════════════════════════ */

export async function seDeconnecter(): Promise<void> {
  await fermerSession();
  revalidatePath('/compte');
}

/* ═══════════════════════════════════════════════════════════════════════════
   Mot de passe oublié
   ═══════════════════════════════════════════════════════════════════════════ */

export async function demanderNouveauMotDePasse(
  _precedent: EtatCompte | null,
  formData: FormData,
): Promise<EtatCompte> {
  if (!accountsEnabled()) return FERMES;

  const analyse = motDePasseOublieSchema.safeParse({ email: formData.get('email') });
  if (!analyse.success) return premierDefaut(analyse.error);

  if (!magicLinkEnabled()) {
    /*
      Sans serveur d'envoi, on ne peut RIEN faire — et il faut le dire au lieu
      de rendre la réponse rassurante habituelle. Promettre un courriel qui ne
      partira jamais laisserait quelqu'un attendre indéfiniment le seul moyen
      de récupérer son compte.
    */
    return {
      ok: false,
      message:
        'L’envoi de courriel n’est pas configuré sur ce site : aucun lien de réinitialisation ne peut partir. Écrivez-nous depuis la page de contact.',
    };
  }

  const budget = await consommer(BUDGETS.connexionAdresse, analyse.data.email);
  if (budget.panne) return COMPTEUR_EN_PANNE;
  if (!budget.allowed) {
    return {
      ok: false,
      message: `Trop de demandes pour cette adresse. Réessayez dans ${delaiLisible(budget.resetAt)}.`,
    };
  }

  const identifiants = await identifiantsDe(analyse.data.email);

  if (identifiants !== null) {
    const jeton = await ouvrirReinitialisation(identifiants.userId);
    const lien = absoluteUrl(`/compte/nouveau-mot-de-passe?jeton=${encodeURIComponent(jeton)}`);

    try {
      const { envoyerReinitialisation } = await import('@/lib/mail/reinitialisation');
      await envoyerReinitialisation(analyse.data.email, lien);
    } catch (error) {
      console.error('[compte] envoi de réinitialisation impossible', error);
      await rembourser(BUDGETS.connexionAdresse, analyse.data.email);
      return {
        ok: false,
        message: 'Le service d’envoi ne répond pas. Ce n’est pas votre adresse : réessayez plus tard.',
      };
    }
  }

  /*
    Réponse IDENTIQUE que l'adresse existe ou non — ici, contrairement à
    l'inscription, il n'y a aucune raison de le révéler.
  */
  return {
    ok: true,
    message:
      'Si un compte existe avec cette adresse, un lien vient d’y être envoyé. Il est valable une heure et ne sert qu’une fois.',
  };
}

export async function definirNouveauMotDePasse(
  _precedent: EtatCompte | null,
  formData: FormData,
): Promise<EtatCompte> {
  if (!accountsEnabled()) return FERMES;

  const analyse = nouveauMotDePasseSchema.safeParse({
    token: formData.get('jeton'),
    password: formData.get('password'),
    passwordConfirm: formData.get('password_confirm'),
  });
  if (!analyse.success) return premierDefaut(analyse.error);

  const userId = await consommerReinitialisation(analyse.data.token);
  if (userId === null) {
    return {
      ok: false,
      message:
        'Ce lien n’est plus valable : il a expiré, ou il a déjà servi. Demandez-en un nouveau.',
    };
  }

  await remplacerMotDePasse(userId, await hacher(analyse.data.password));

  /*
    On n'ouvre PAS de session ici. `remplacerMotDePasse` vient de fermer
    toutes les sessions du compte ; en rouvrir une immédiatement depuis un
    lien reçu par courriel donnerait accès au compte à quiconque a lu ce
    courriel, sans jamais taper le nouveau mot de passe.
  */
  return {
    ok: true,
    message: 'Mot de passe changé. Toutes vos sessions ont été fermées : connectez-vous.',
  };
}

/** Le compte est-il connecté ? Utilisé par les pages qui doivent choisir un affichage. */
export async function estConnecte(): Promise<boolean> {
  return (await currentUser()) !== null;
}
