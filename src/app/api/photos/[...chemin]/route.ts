import { readFile } from 'node:fs/promises';
import { NextResponse } from 'next/server';

import { resolvePhoto } from '@/lib/photo/storage';

export const runtime = 'nodejs';

/**
 * Lecture d'une photo de prise.
 *
 * Les photos vivent HORS du répertoire de l'application — un déploiement le
 * remplace — donc elles ne peuvent pas être servies comme des fichiers
 * statiques. Cette route les lit et les rend, en contrôlant le chemin.
 *
 * `resolvePhoto` est le contrôle qui compte : un chemin venu de la base n'est
 * pas digne de confiance par principe, et « ../../etc/passwd » doit rendre une
 * absence, pas un fichier.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ chemin: string[] }> },
): Promise<NextResponse> {
  const { chemin } = await params;
  const absolute = resolvePhoto(chemin.join('/'));

  if (!absolute) return new NextResponse('Introuvable', { status: 404 });

  try {
    const bytes = await readFile(absolute);
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        'content-type': 'image/jpeg',
        // Le nom d'une photo contient un UUID : son contenu ne change jamais.
        // Un cache long est donc sûr, et évite de relire le disque à chaque
        // affichage d'une page de spot.
        'cache-control': 'public, max-age=31536000, immutable',
        // Une photo déposée par un tiers ne doit jamais être interprétée comme
        // autre chose qu'une image, quoi qu'en dise son contenu.
        'x-content-type-options': 'nosniff',
      },
    });
  } catch {
    return new NextResponse('Introuvable', { status: 404 });
  }
}
