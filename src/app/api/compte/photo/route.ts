import { NextResponse } from 'next/server';

import { currentUser } from '@/lib/auth/session';
import { MAX_STORED_BYTES, savePhoto } from '@/lib/photo/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Dépôt d'une photo de prise.
 *
 * Le fichier reçu ici a DÉJÀ été nettoyé de ses métadonnées dans le
 * navigateur : l'original, avec ses coordonnées GPS, n'a jamais quitté
 * l'appareil. Ce point d'accès ne fait donc pas le nettoyage, il le suppose —
 * et le vérifie à sa façon en n'acceptant que du JPEG dont il contrôle la
 * signature.
 *
 * Il exige une session : un dépôt anonyme serait un espace de stockage gratuit
 * offert à internet.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, message: 'Connectez-vous pour envoyer une photo.' },
      { status: 401 },
    );
  }

  const length = Number(request.headers.get('content-length') ?? 0);
  if (Number.isFinite(length) && length > MAX_STORED_BYTES * 2) {
    // Refus AVANT lecture du corps : lire douze mégaoctets pour les rejeter
    // ensuite offrirait un moyen simple de saturer le serveur.
    return NextResponse.json({ ok: false, message: 'Photo trop lourde.' }, { status: 413 });
  }

  let bytes: Uint8Array;
  let contentType: string;

  try {
    const form = await request.formData();
    const file = form.get('photo');

    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, message: 'Aucun fichier reçu.' }, { status: 400 });
    }

    contentType = file.type;
    bytes = new Uint8Array(await file.arrayBuffer());
  } catch {
    return NextResponse.json({ ok: false, message: 'Envoi illisible.' }, { status: 400 });
  }

  const saved = await savePhoto(user.id, bytes, contentType);
  if (!saved.ok) return NextResponse.json({ ok: false, message: saved.message }, { status: 422 });

  return NextResponse.json({ ok: true, path: saved.path });
}
