import { NextResponse, type NextRequest } from 'next/server';

import { purgeExpired } from '@/lib/auth/mysql-adapter';
import { sendOutingAlerts } from '@/lib/contributions/alerts';
import { mailEnabled } from '@/lib/auth/config';
import { databaseEnabled } from '@/lib/db/mysql';
import { refusExplique } from '@/lib/diagnostic/refus';
import { RETENTION_MS } from '@/lib/limites';
import { purgeRateLimits } from '@/lib/providers/mysql/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Entretien quotidien : purge des sessions et des liens de connexion périmés,
 * puis envoi des alertes de sortie de la veille.
 *
 * Les deux vivent dans la même route pour une raison pratique : chez un
 * hébergeur mutualisé, chaque tâche cron se déclare à la main dans un panneau.
 * Une seule URL à appeler, un seul secret à coller.
 *
 * Sans lui, deux tables grossissent indéfiniment. Auth.js ne supprime que ce
 * qu'il touche : une session expirée que personne ne rouvre, ou un lien de
 * connexion jamais cliqué, restent en base pour toujours. Sur un hébergement
 * mutualisé où l'espace est compté, c'est une fuite lente — et ce sont des
 * données personnelles conservées sans raison, ce que la politique de
 * confidentialité ne prévoit pas.
 *
 * Remplace la route de maintien en éveil de l'époque Supabase : MySQL chez
 * l'hébergeur ne se met pas en pause, il n'y a plus rien à réveiller.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  /*
    Le secret ferme la route au public quand il est défini. Sans lui elle reste
    ouverte, ce qui est acceptable pour une purge de lignes déjà expirées, mais
    on préfère la fermer : une URL publique qui déclenche des suppressions est
    un levier gratuit pour faire travailler la base.
  */
  const secret = process.env.CRON_SECRET?.trim();
  if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) {
    return refusExplique(request.headers.get('authorization'));
  }

  if (!databaseEnabled()) {
    // Pas de base : rien à entretenir, et ce n'est pas une erreur. Répondre 200
    // évite qu'une tâche planifiée soit signalée en échec sur un déploiement
    // qui n'a tout simplement pas de base.
    return NextResponse.json({ ok: true, state: 'sans-base' });
  }

  try {
    const purged = await purgeExpired();

    // Les compteurs d'appel sortis de la plus longue fenêtre ne servent plus
    // à rien. Les garder ne fausserait aucun calcul — chaque requête borne
    // déjà sur `hit_at` — mais la table grossirait sans fin.
    const limites = await purgeRateLimits(RETENTION_MS);

    // Sans courriel configuré, les alertes n'ont nulle part où partir : on
    // le dit dans la réponse plutôt que de compter des échecs.
    const alerts = mailEnabled() ? await sendOutingAlerts() : null;

    return NextResponse.json({ ok: true, state: 'entretenu', ...purged, limites, alerts });
  } catch (error) {
    console.error('[entretien] purge impossible', error);
    return NextResponse.json(
      { ok: false, state: 'echec', message: 'La base n’a pas répondu.' },
      { status: 503 },
    );
  }
}
