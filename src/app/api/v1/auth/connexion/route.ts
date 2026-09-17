import { connexionSchema } from '@/data/schemas-compte';
import { accountsEnabled } from '@/lib/auth/config';
import { verifierIdentifiants } from '@/lib/auth/identification';
import { BUDGETS, consommer, delaiLisible } from '@/lib/limites';
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
 * Connexion par adresse et mot de passe. Rend un jeton de session.
 *
 * ── Un seul et même refus, quelle qu'en soit la cause ────────────────────
 *
 * « Adresse inconnue » et « mot de passe faux » se répondent EXACTEMENT
 * pareil, avec le même code et le même message. Les distinguer transformerait
 * cette route en outil de vérification d'adresses : n'importe qui saurait, en
 * quelques milliers d'appels, qui a un compte ici. Le temps de réponse est
 * égalisé de la même façon, dans `verifierIdentifiants`.
 *
 * ── Le verrou de compte, lui, s'annonce ──────────────────────────────────
 *
 * Il ne révèle rien qu'un attaquant ne sache déjà : c'est lui qui vient de
 * l'obtenir en se trompant huit fois. Le taire laisserait en revanche la
 * personne légitime devant un « mot de passe incorrect » qu'elle sait faux,
 * sans comprendre pourquoi son mot de passe a cessé de marcher.
 */
export async function POST(requete: Request): Promise<Response> {
  if (!accountsEnabled()) return COMPTES_FERMES();

  const corps = await corpsJson(requete);
  if (corps === null) return CORPS_ILLISIBLE();

  const analyse = connexionSchema.safeParse(corps);
  if (!analyse.success) return saisieInvalide(analyse.error);

  const budget = await consommer(BUDGETS.connexionMotDePasseIp, ipDeRequete(requete));
  if (budget.panne) {
    return refus(
      503,
      'indisponible',
      'Le compteur de sécurité ne répond pas. Ce n’est ni votre adresse ni un excès de tentatives : réessayez dans quelques minutes.',
    );
  }
  if (!budget.allowed) {
    return tropDeDemandes(
      `Trop de tentatives depuis cet accès. Réessayez dans ${delaiLisible(budget.resetAt)}.`,
      budget.resetAt,
    );
  }

  const verdict = await verifierIdentifiants(analyse.data.email, analyse.data.password);

  if (!verdict.ok) {
    if (verdict.raison === 'verrouille') {
      return tropDeDemandes(
        `Ce compte est temporairement bloqué après plusieurs tentatives. Réessayez dans ${delaiLisible(verdict.jusqua)}.`,
        verdict.jusqua,
      );
    }

    return refus(
      401,
      'non-authentifie',
      'Adresse e-mail ou mot de passe incorrect. Vérifiez votre saisie, ou demandez un nouveau mot de passe depuis le site.',
    );
  }

  const session = await ouvrirSessionPorteur(verdict.userId);
  return succes(session);
}
