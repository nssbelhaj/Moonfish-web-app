import { checkMysqlLimit, refundMysqlLimit } from '@/lib/providers/mysql/rate-limit';

import type { Budget } from './persistant';

/**
 * Le budget journalier de requêtes Stormglass, compté EN BASE.
 *
 * Le palier gratuit accorde dix requêtes par jour. On s'en réserve huit :
 * la marge couvre l'essai du diagnostic et un redéploiement dans la journée.
 * Le compteur vit dans `rate_limits`, la même table que les limites de
 * courriel — il survit donc aux redémarrages et vaut pour toutes les
 * instances, ce qu'un compteur en mémoire ne ferait pas.
 *
 * Fenêtre glissante de vingt-quatre heures, plus stricte qu'un jour civil :
 * on ne peut jamais dépasser, quel que soit le fuseau où le fournisseur
 * remet son compteur à zéro.
 */
export const REQUETES_PAR_JOUR = 8;
const FENETRE_MS = 24 * 3_600_000;
const SEAU = 'stormglass';
/** `subject` est un `char(32)` d'empreinte ; ici il n'y a rien à empreindre. */
const SUJET = 'quota-journalier-stormglass-0000';

export function budgetStormglassEnBase(limite = REQUETES_PAR_JOUR): Budget {
  return {
    async reserver() {
      const decision = await checkMysqlLimit(SEAU, SUJET, limite, FENETRE_MS);
      return decision.allowed;
    },
    async rendre() {
      await refundMysqlLimit(SEAU, SUJET);
    },
  };
}
