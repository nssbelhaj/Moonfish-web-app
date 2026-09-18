import { spots } from '@/lib/providers';
import { succes } from '@/lib/api/reponse';

/**
 * Le catalogue des spots.
 *
 * ── Pourquoi cette route est la PREMIÈRE que l'application appelle ───────
 *
 * Elle porte les positions, et c'est ce qui permet de tenir la promesse
 * « la position ne quitte jamais l'appareil ». L'application télécharge le
 * catalogue une fois, puis calcule les distances CHEZ ELLE pour trouver le
 * spot le plus proche. Aucun point d'accès de ce serveur ne sait recevoir une
 * position, et `position-jamais-recue.test.ts` échoue si l'un se met à en
 * accepter une.
 *
 * ── Mise en cache plutôt que comptage d'appels ───────────────────────────
 *
 * Le catalogue ne bouge qu'au déploiement. Servie depuis le cache, cette
 * route ne touche ni la base ni un fournisseur : la limiter par adresse IP
 * protégerait contre un coût qui n'existe pas, et enfermerait dehors les
 * abonnés partageant le NAT d'un opérateur mobile — des milliers derrière une
 * seule adresse.
 */
export const revalidate = 3600;

export async function GET(): Promise<Response> {
  return succes({ spots: await spots.list() });
}
