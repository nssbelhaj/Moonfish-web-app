'use server';

import { revalidatePath } from 'next/cache';

import { signIn } from '@/auth';

import {
  connexionSchema,
  inscriptionSchema,
  motDePasseOublieSchema,
  nouveauMotDePasseSchema,
  preferencesSchema,
  profilSchema,
} from '@/data/schemas-compte';
import { accountsEnabled, googleEnabled, magicLinkEnabled } from '@/lib/auth/config';
import { hacher } from '@/lib/auth/password';
import { creerCompte, verifierIdentifiants } from '@/lib/auth/identification';
import { piegeDeclenche } from '@/lib/auth/piege';
import { fermerSession, ouvrirSession } from '@/lib/auth/session-cookie';
import { currentUser } from '@/lib/auth/session';
import { BUDGETS, consommer, delaiLisible, ipAppelante, rembourser } from '@/lib/limites';
import { deletePhoto } from '@/lib/photo/storage';
import {
  consommerReinitialisation,
  identifiantsDe,
  majPreferences,
  majProfil,
  ouvrirReinitialisation,
  retirerAvatar,
  remplacerMotDePasse,
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

const NON_CONNECTE: EtatCompte = {
  ok: false,
  message: 'Session expirée. Reconnectez-vous et recommencez : votre saisie n’a pas été perdue.',
};

/** Budget d'écriture du profil : les mêmes règles que les contributions. */
async function budgetProfil(userId: string): Promise<EtatCompte | null> {
  const decision = await consommer(BUDGETS.contribution, userId);
  if (decision.allowed) return null;
  if (decision.panne) return COMPTEUR_EN_PANNE;

  return {
    ok: false,
    message: `Trop d’enregistrements d’affilée. Réessayez dans ${delaiLisible(decision.resetAt)}.`,
  };
}

/*
  Message du champ-piège. Il dit VRAI sans dire comment : nommer le champ
  apprendrait à celui qui l'a rempli exprès lequel laisser vide la fois
  suivante. Un humain ne peut pas le lire — le champ lui est inatteignable —
  sauf si le piège se casse, et dans ce cas la phrase doit lui rester
  compréhensible et lui donner un recours.
*/
const ROBOT =
  'Cette demande a été écartée par une protection automatique. Si vous êtes bien une personne, rechargez la page et recommencez ; écrivez-nous si cela se reproduit.';

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

  /*
    Le champ-piège d'abord, avant toute écriture et même avant le budget : un
    robot qui s'y prend ne doit consommer ni ligne de compteur, ni requête, et
    surtout pas le quota d'un accès partagé — un hôtel, un campus, un
    téléphone en partage de connexion — où il enfermerait dehors des gens
    réels.
  */
  if (piegeDeclenche(formData)) {
    console.warn('[inscription] champ-piège rempli, demande écartée');
    return { ok: false, message: ROBOT };
  }

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

  // La règle du nom affiché — le prénom seul, jamais « Prénom NOM » — vit
  // dans `creerCompte`, partagée avec l'inscription par l'API mobile.
  const resultat = await creerCompte({ email, password, firstName, lastName, birthDate });

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

  /*
    Vérification, verrou de compte et comparaison à temps constant vivent dans
    `verifierIdentifiants`, partagée avec la route de connexion de l'API
    mobile. Recopier ces règles ici aurait fini par les faire diverger — un
    verrou appliqué d'un côté et pas de l'autre ne se voit sur aucun écran.
  */
  const verdict = await verifierIdentifiants(analyse.data.email, analyse.data.password);

  if (!verdict.ok) {
    if (verdict.raison === 'verrouille') {
      return {
        ok: false,
        message: `Ce compte est temporairement bloqué après plusieurs tentatives. Réessayez dans ${delaiLisible(verdict.jusqua)}.`,
      };
    }
    return REFUS;
  }

  await ouvrirSession(verdict.userId);
  revalidatePath('/compte');

  return { ok: true, message: 'Vous êtes connecté.' };
}

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

/* ═══════════════════════════════════════════════════════════════════════════
   Profil : informations déclaratives et préférences
   ═══════════════════════════════════════════════════════════════════════════ */

export async function enregistrerProfil(
  _precedent: EtatCompte | null,
  formData: FormData,
): Promise<EtatCompte> {
  const utilisateur = await currentUser();
  if (utilisateur === null) return NON_CONNECTE;

  const analyse = profilSchema.safeParse({
    firstName: formData.get('first_name') ?? '',
    lastName: formData.get('last_name') ?? '',
    city: formData.get('city') ?? '',
    country: formData.get('country') ?? '',
    bio: formData.get('bio') ?? '',
  });
  if (!analyse.success) return premierDefaut(analyse.error);

  const trop = await budgetProfil(utilisateur.id);
  if (trop) return trop;

  await majProfil(utilisateur.id, analyse.data);
  revalidatePath('/compte');

  return { ok: true, message: 'Profil enregistré.' };
}

export async function enregistrerPreferences(
  _precedent: EtatCompte | null,
  formData: FormData,
): Promise<EtatCompte> {
  const utilisateur = await currentUser();
  if (utilisateur === null) return NON_CONNECTE;

  /*
    Une case non cochée n'est pas transmise : son absence vaut « non ». C'est
    la mécanique des formulaires HTML, et elle est ici la bonne — décocher
    puis enregistrer doit désactiver, pas laisser en l'état.
  */
  const preferences = preferencesSchema.parse({
    notifyOutings: formData.get('notify_outings') === 'oui',
    notifyNews: formData.get('notify_news') === 'oui',
  });

  const trop = await budgetProfil(utilisateur.id);
  if (trop) return trop;

  await majPreferences(utilisateur.id, preferences);
  revalidatePath('/compte');

  return { ok: true, message: 'Préférences enregistrées.' };
}

export async function supprimerAvatar(): Promise<void> {
  const utilisateur = await currentUser();
  if (utilisateur === null) return;

  const ancien = await retirerAvatar(utilisateur.id);
  if (ancien) await deletePhoto(ancien).catch(() => undefined);

  revalidatePath('/compte');
}

/**
 * « Continuer avec Google » : on confie la suite à Auth.js.
 *
 * Rien n'est lu ni écrit ici ; Auth.js redirige vers Google, reçoit le
 * retour sur `/api/auth/callback/google`, crée ou retrouve le compte par
 * l'adresse, ouvre une session en base, et revient sur `/compte`. Si le
 * profil n'existe pas encore, la page demande le nom affiché, la date de
 * naissance et le consentement — comme pour le lien par courriel.
 */
export async function connecterAvecGoogle(): Promise<void> {
  if (!googleEnabled()) return;
  await signIn('google', { redirectTo: '/compte' });
}
