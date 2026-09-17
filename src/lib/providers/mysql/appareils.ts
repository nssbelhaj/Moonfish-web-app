import { execute, query } from '@/lib/db/mysql';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  Les appareils qui reçoivent les notifications
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Une seule chose y est stockée : à qui envoyer, et par quelle plateforme.
 * Ni modèle, ni version du système, ni identifiant publicitaire. Ce qui n'est
 * pas nécessaire à l'envoi n'a pas à être conservé, et la page de
 * confidentialité affirme qu'on ne profile personne.
 *
 * ── `user_id = ?` est sur chaque écriture, sans exception ────────────────
 *
 * MySQL n'a pas l'équivalent de la sécurité au niveau des lignes de
 * PostgreSQL : c'est la signature des fonctions et cette condition qui en
 * tiennent lieu. `proprietaire.test.ts` échoue si une modification l'oublie.
 * Concrètement, sans elle, quiconque connaîtrait le jeton d'un autre pourrait
 * le supprimer — donc le couper de ses alertes.
 */

export type Plateforme = 'ios' | 'android';

export interface Appareil {
  token: string;
  platform: Plateforme;
  label: string | null;
}

/**
 * Enregistre un appareil, ou rafraîchit celui qui porte déjà ce jeton.
 *
 * ── Idempotent, et il doit l'être ────────────────────────────────────────
 *
 * L'application réenregistre son jeton à CHAQUE démarrage : c'est la seule
 * façon de savoir qu'il est encore valide, la plateforme pouvant le faire
 * tourner sans prévenir. Une insertion simple échouerait au deuxième
 * lancement, et l'application ne recevrait plus rien à partir du moment où
 * elle a cessé de pouvoir s'enregistrer.
 *
 * `user_id` est dans le `update` parce qu'un téléphone change de main, ou de
 * compte : le jeton doit alors suivre le nouveau propriétaire, sans quoi les
 * alertes de l'ancien continueraient d'arriver sur un appareil qui n'est plus
 * le sien.
 */
export async function enregistrerAppareil(
  userId: string,
  appareil: Appareil,
): Promise<void> {
  await execute(
    `insert into push_devices (token, user_id, platform, label)
       values (?, ?, ?, ?)
     on duplicate key update
       user_id = values(user_id),
       platform = values(platform),
       label = values(label),
       last_seen_at = current_timestamp(3)`,
    [appareil.token, userId, appareil.platform, appareil.label],
  );
}

/** Les appareils d'une personne, pour lui envoyer une alerte. */
export async function appareilsDe(userId: string): Promise<Appareil[]> {
  const lignes = await query<{ token: string; platform: string; label: string | null }>(
    'select token, platform, label from push_devices where user_id = ? order by last_seen_at desc',
    [userId],
  );

  return lignes.map((ligne) => ({
    token: ligne.token,
    platform: ligne.platform === 'ios' ? 'ios' : 'android',
    label: ligne.label,
  }));
}

/**
 * Retire un appareil.
 *
 * `user_id = ?` filtre la suppression : connaître un jeton ne suffit pas à
 * couper quelqu'un d'autre de ses alertes.
 */
export async function retirerAppareil(userId: string, token: string): Promise<void> {
  await execute('delete from push_devices where user_id = ? and token = ?', [userId, token]);
}
