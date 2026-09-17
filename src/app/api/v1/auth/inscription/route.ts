import { inscriptionSchema } from '@/data/schemas-compte';
import { accountsEnabled } from '@/lib/auth/config';
import { creerCompte } from '@/lib/auth/identification';
import { BUDGETS, consommer, delaiLisible, rembourser } from '@/lib/limites';
import {
  COMPTES_FERMES,
  CORPS_ILLISIBLE,
  corpsJson,
  refus,
  saisieInvalide,
  succes,
  tropDeDemandes,
} from '@/lib/api/reponse';
import { ipDeRequete, ouvrirSessionPorteur } from '@/lib/api/porteur';

export const dynamic = 'force-dynamic';

/**
 * Création de compte. Rend un jeton de session, comme la connexion.
 *
 * ── Les mêmes règles que le formulaire du site, sans exception ───────────
 *
 * `inscriptionSchema` est celui du web : quinze ans révolus, consentement
 * explicite, mot de passe saisi deux fois. Ce n'est pas de la rigidité — le
 * seuil d'âge est une obligation légale, et le faire varier selon le bouton
 * par lequel on passe reviendrait à ne pas l'avoir. L'application envoie donc
 * `passwordConfirm` et `consentement`, exactement comme le formulaire.
 *
 * ── Ce que l'API ne reprend PAS du formulaire ────────────────────────────
 *
 * Le champ-piège (`piegeDeclenche`). Il n'a de sens que sur une page HTML, où
 * un robot remplit tout ce qu'il trouve ; dans un corps JSON il ne ferait
 * qu'ajouter un champ à documenter, que tout robot omettrait aussitôt. Ce qui
 * protège cette route, c'est le budget par adresse d'appel.
 *
 * ── « Adresse déjà prise » est dit, et c'est assumé ──────────────────────
 *
 * Contrairement à la connexion, qui ne dit jamais si une adresse existe. Sans
 * ce message, quelqu'un dont l'adresse est déjà inscrite se heurterait à un
 * refus incompréhensible — et il n'apprend rien qu'une tentative de connexion
 * ne lui apprendrait.
 */
export async function POST(requete: Request): Promise<Response> {
  if (!accountsEnabled()) return COMPTES_FERMES();

  const corps = await corpsJson(requete);
  if (corps === null) return CORPS_ILLISIBLE();

  const analyse = inscriptionSchema.safeParse(corps);
  if (!analyse.success) return saisieInvalide(analyse.error);

  const ip = ipDeRequete(requete);
  const budget = await consommer(BUDGETS.inscriptionIp, ip);
  if (budget.panne) {
    return refus(
      503,
      'indisponible',
      'Le compteur de sécurité ne répond pas. Réessayez dans quelques minutes.',
    );
  }
  if (!budget.allowed) {
    return tropDeDemandes(
      `Trop d’inscriptions depuis cet accès. Réessayez dans ${delaiLisible(budget.resetAt)}.`,
      budget.resetAt,
    );
  }

  const { email, password, firstName, lastName, birthDate } = analyse.data;
  const resultat = await creerCompte({ email, password, firstName, lastName, birthDate });

  if (!resultat.ok) {
    if (resultat.raison === 'adresse-prise') {
      return refus(
        409,
        'saisie-invalide',
        'Un compte existe déjà avec cette adresse. Connectez-vous, ou demandez un nouveau mot de passe depuis le site.',
        'email',
      );
    }

    /*
      Le budget se prend AVANT l'action, sans quoi deux demandes simultanées
      liraient le même compteur et passeraient toutes les deux. Quand l'action
      échoue, la personne n'a rien obtenu : lui laisser l'unité sur le dos la
      ferait payer pour une panne du serveur.
    */
    await rembourser(BUDGETS.inscriptionIp, ip);
    return refus(
      503,
      'indisponible',
      'La création du compte a échoué côté serveur. Votre saisie est valide : réessayez dans un instant.',
    );
  }

  const session = await ouvrirSessionPorteur(resultat.userId);
  return succes({ ...session, displayName: resultat.displayName }, undefined);
}
