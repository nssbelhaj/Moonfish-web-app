import { accountsEnabled } from '@/lib/auth/config';
import { contributions } from '@/lib/providers';
import { BUDGETS, consommer, delaiLisible, type Budget } from '@/lib/limites';
import {
  COMPTES_FERMES,
  NON_AUTHENTIFIE,
  refus,
  tropDeDemandes,
} from '@/lib/api/reponse';
import { porteurDe, type PorteurValide } from '@/lib/api/porteur';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  Le portier des routes de compte
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Trois contrôles, toujours dans le même ordre, et cet ordre a des raisons :
 *
 *  1. Les comptes sont-ils ouverts ? Sinon rien de ce qui suit n'a de sens, et
 *     la base n'a pas à être dérangée.
 *  2. Le jeton est-il valide ? Il coûte un `select` sur une colonne indexée.
 *  3. Le budget est-il disponible ? Il s'écrit en base, donc il coûte plus que
 *     les deux précédents — inutile de le dépenser pour un anonyme.
 *
 * ── Le budget est compté par UTILISATEUR, pas par adresse IP ─────────────
 *
 * Et c'est la différence majeure avec le web. Derrière le NAT d'un opérateur
 * mobile, des milliers d'abonnés partagent une seule adresse : un budget par
 * IP y enfermerait dehors des gens qui n'ont rien fait, tout en laissant
 * passer celui qui change de réseau. Une fois le jeton vérifié, on sait de qui
 * il s'agit — c'est la clé juste.
 *
 * Les routes d'authentification, elles, ne peuvent pas faire autrement que de
 * compter par IP : personne n'est encore identifié. C'est pourquoi elles ne
 * passent pas par ici.
 */

export type Garde =
  | { ok: true; porteur: PorteurValide }
  | { ok: false; reponse: Response };

export async function exigerPorteur(
  requete: Request,
  budget: Budget = BUDGETS.contribution,
): Promise<Garde> {
  if (!accountsEnabled()) return { ok: false, reponse: COMPTES_FERMES() };

  const porteur = await porteurDe(requete);
  if (porteur === null) return { ok: false, reponse: NON_AUTHENTIFIE() };

  const decision = await consommer(budget, porteur.id);

  if (decision.panne) {
    return {
      ok: false,
      reponse: refus(
        503,
        'indisponible',
        'Le compteur de sécurité ne répond pas — la base est joignable mais incomplète. Ce n’est pas un excès de demandes de votre part : les migrations n’ont probablement pas été appliquées au déploiement.',
      ),
    };
  }

  if (!decision.allowed) {
    return {
      ok: false,
      reponse: tropDeDemandes(
        `Trop d’enregistrements d’affilée. Réessayez dans ${delaiLisible(decision.resetAt)}.`,
        decision.resetAt,
      ),
    };
  }

  return { ok: true, porteur };
}

/**
 * Lecture authentifiée, SANS consommer de budget.
 *
 * Consulter son propre compte ne coûte que des `select` bornés, et c'est le
 * premier appel que fait l'application à chaque ouverture. Lui faire dépenser
 * une unité du budget d'écriture le viderait avant que la personne n'ait rien
 * écrit — puis lui refuserait la prise qu'elle voulait justement déclarer.
 */
export async function exigerLecteur(requete: Request): Promise<Garde> {
  if (!accountsEnabled()) return { ok: false, reponse: COMPTES_FERMES() };

  const porteur = await porteurDe(requete);
  if (porteur === null) return { ok: false, reponse: NON_AUTHENTIFIE() };

  return { ok: true, porteur };
}

/**
 * Le porteur ET son nom affiché, exigés pour tout ce qui se publie.
 *
 * ── Pourquoi le nom affiché est une condition, et pas un défaut ──────────
 *
 * Un avis et une prise publique sont SIGNÉS : le nom apparaît sous eux, pour
 * tout le monde. Fabriquer un nom à la volée — l'adresse e-mail tronquée, un
 * « Pêcheur 42 » — publierait quelque chose que la personne n'a pas choisi,
 * sous une identité qu'elle n'a pas décidée. On refuse donc, en disant quoi
 * faire.
 *
 * Favoris et sorties, eux, n'en demandent pas : personne d'autre ne les voit.
 * Un compte fraîchement créé peut suivre un spot avant même d'avoir choisi
 * comment il signera un avis — c'est déjà la règle du site.
 */
export type GardeAuteur =
  | { ok: true; porteur: PorteurValide; auteur: { userId: string; displayName: string } }
  | { ok: false; reponse: Response };

export async function exigerAuteur(
  requete: Request,
  budget: Budget = BUDGETS.contribution,
): Promise<GardeAuteur> {
  const garde = await exigerPorteur(requete, budget);
  if (!garde.ok) return garde;

  const profil = await contributions.getProfile(garde.porteur.id);

  if (profil === null) {
    return {
      ok: false,
      reponse: refus(
        409,
        'saisie-invalide',
        'Choisissez d’abord un nom affiché : c’est lui qui signera votre avis ou votre prise. Vous pouvez le faire depuis l’écran Compte.',
        'displayName',
      ),
    };
  }

  return {
    ok: true,
    porteur: garde.porteur,
    auteur: { userId: garde.porteur.id, displayName: profil.displayName },
  };
}
