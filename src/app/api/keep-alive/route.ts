import { NextResponse, type NextRequest } from 'next/server';

import { SUPABASE_CONFIG } from '@/lib/supabase/config';
import { supabasePublic } from '@/lib/supabase/public';

export const dynamic = 'force-dynamic';

/**
 * Maintien en éveil du projet Supabase.
 *
 * Le palier gratuit met un projet en PAUSE après sept jours de faible activité.
 * Le site s'auto-entretient tant qu'il reçoit des visites — chaque
 * revalidation d'une page de spot interroge la base — mais une semaine sans
 * visiteur suffit à le faire basculer. Ce point d'accès est le plancher : une
 * requête par jour, déclenchée par une tâche planifiée, et le compteur
 * d'inactivité ne repart jamais de zéro.
 *
 * Ce n'est pas un contournement de la tarification : Supabase demande
 * explicitement « quelques requêtes par jour » pour considérer un projet actif.
 * On les fait, honnêtement, avec la charge la plus faible possible.
 *
 * La requête ne lit QUE des données publiques, par le client sans session : ce
 * point d'accès ne peut donc rien apprendre de plus qu'un visiteur anonyme,
 * même s'il était appelé par un tiers.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  /*
    Vercel ajoute `Authorization: Bearer $CRON_SECRET` à ses appels planifiés
    dès que la variable existe. Sans elle, la route reste ouverte — ce qui est
    acceptable pour une requête aussi légère, mais on préfère la fermer quand
    on peut : une URL publique qui déclenche un appel à la base est un levier
    gratuit pour saturer un quota.
  */
  const secret = process.env.CRON_SECRET?.trim();
  if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, message: 'Non autorisé.' }, { status: 401 });
  }

  if (SUPABASE_CONFIG === null) {
    // Pas de projet configuré : rien à maintenir en éveil, et ce n'est pas une
    // erreur. Répondre 200 évite qu'une tâche planifiée soit signalée en échec
    // sur un déploiement qui n'a tout simplement pas de base.
    return NextResponse.json({ ok: true, state: 'sans-base' });
  }

  const client = supabasePublic();
  if (!client) return NextResponse.json({ ok: true, state: 'sans-base' });

  const startedAt = Date.now();

  // Deux lectures minuscules plutôt qu'une : Supabase parle de « quelques
  // requêtes par jour », et deux index touchés valent mieux qu'un seul appel
  // qui pourrait être servi par un cache.
  const [reviews, catches] = await Promise.all([
    client.from('spot_reviews').select('id').limit(1),
    client.from('catches').select('id').limit(1),
  ]);

  const elapsedMs = Date.now() - startedAt;
  const error = reviews.error ?? catches.error;

  if (error) {
    /*
      Un projet EN PAUSE répond en échec ici : c'est précisément le signal
      qu'on veut voir dans les journaux, avec un message qui nomme la cause
      probable plutôt qu'un « fetch failed » qu'il faudrait interpréter.
    */
    console.error('[keep-alive] base injoignable', error.message);
    return NextResponse.json(
      {
        ok: false,
        state: 'injoignable',
        elapsedMs,
        message:
          'La base n’a pas répondu. Si le projet Supabase est en pause, il faut le relancer depuis le tableau de bord : une tâche planifiée ne le réveille pas.',
      },
      { status: 503 },
    );
  }

  return NextResponse.json({ ok: true, state: 'eveille', elapsedMs });
}
