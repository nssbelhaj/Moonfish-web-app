import { NextResponse, type NextRequest } from 'next/server';

import { databaseEnabled } from '@/lib/db/mysql';
import { cheminComptable, enregistrerVisite } from '@/lib/visites/compter';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Une page vue. Le corps est le chemin, en texte brut, tel que
 * `navigator.sendBeacon` l'envoie.
 *
 * Cette route ne lit AUCUN en-tête d'identification — ni `x-forwarded-for`,
 * ni `user-agent`, ni cookie. Elle lit `sec-gpc` et `dnt` pour NE PAS
 * compter, jamais pour compter mieux. Elle répond 204 dans tous les cas :
 * un compteur qui échoue n'a rien à dire au navigateur.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const refus = request.headers.get('sec-gpc') === '1' || request.headers.get('dnt') === '1';
  if (refus || !databaseEnabled()) return new NextResponse(null, { status: 204 });

  const chemin = cheminComptable(await request.text().catch(() => null));
  if (chemin === null) return new NextResponse(null, { status: 204 });

  try {
    await enregistrerVisite(chemin);
  } catch (error) {
    // Un compteur en panne ne vaut pas une erreur visible, ni une ligne de
    // journal par visite : une seule, sobre.
    console.error('[visites] enregistrement impossible', error instanceof Error ? error.message : error);
  }

  return new NextResponse(null, { status: 204 });
}
