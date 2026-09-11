import { databaseEnabled } from '@/lib/db/mysql';
import { currentUser } from '@/lib/auth/session';
import { premierCompte } from '@/lib/providers/mysql/comptes';

/**
 * La personne connectée est-elle celle qui a déployé le site ?
 *
 * Règle : le PREMIER compte créé. Voir `premierCompte()` pour le raisonnement.
 *
 * Ce que cette qualité ouvre se limite à la lecture de l'état de la
 * configuration — jamais une action, jamais les données d'autrui. Elle ne
 * remplace pas `CRON_SECRET`, elle s'ajoute à lui : la tâche planifiée, qui
 * n'a pas de session, continue de passer par le secret.
 */
export async function estProprietaire(): Promise<boolean> {
  if (!databaseEnabled()) return false;

  const utilisateur = await currentUser();
  if (utilisateur === null) return false;

  try {
    return (await premierCompte()) === utilisateur.id;
  } catch (error) {
    /*
      Base incomplète : c'est précisément la panne qu'on cherche à
      diagnostiquer. Refuser est le bon choix — on ne va pas ouvrir un
      diagnostic parce qu'on n'arrive pas à vérifier qui demande.
    */
    console.error('[compte] propriétaire indéterminable', error);
    return false;
  }
}
