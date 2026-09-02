import { NextResponse } from 'next/server';

import { currentUser } from '@/lib/auth/session';
import { contributions } from '@/lib/providers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * État de session, pour la zone « contribuer » d'une page de spot.
 *
 * Pourquoi une route plutôt qu'une lecture côté serveur dans la page : lire la
 * session veut dire lire les cookies, et lire les cookies bascule TOUTE la
 * route en rendu dynamique dans Next. La page des espèces perdrait son
 * pré-rendu et son cache d'une heure pour un encadré de formulaire.
 *
 * Ne rend que ce qui concerne la personne qui demande, et rien d'autre.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const user = await currentUser();

  if (!user) {
    return NextResponse.json(
      { signedIn: false },
      { headers: { 'cache-control': 'no-store, private' } },
    );
  }

  const spotSlug = new URL(request.url).searchParams.get('spot');
  const profile = await contributions.getProfile(user.id);

  let ownReview: { rating: number; comment: string | null } | null = null;

  if (spotSlug && profile) {
    const { reviews } = await contributions.listForUser(user.id);
    const mine = reviews.find((review) => review.spotSlug === spotSlug);
    if (mine) ownReview = { rating: mine.rating, comment: mine.comment };
  }

  return NextResponse.json(
    { signedIn: true, userId: user.id, hasProfile: profile !== null, ownReview },
    { headers: { 'cache-control': 'no-store, private' } },
  );
}
