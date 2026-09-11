import { NextResponse } from 'next/server';

import { currentUser } from '@/lib/auth/session';
import { BUDGETS, consommer, delaiLisible } from '@/lib/limites';
import { majAvatar } from '@/lib/providers/mysql/comptes';
import { MAX_STORED_BYTES, deletePhoto, savePhoto } from '@/lib/photo/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Dépôt d'une photo de profil.
 *
 * Même stockage et mêmes contrôles que les photos de prises — signature JPEG
 * vérifiée sur les octets, chemin préfixé par l'identifiant du propriétaire.
 * Un avatar n'est pas un cas particulier : c'est une photo de plus, et lui
 * inventer un chemin d'écriture séparé dupliquerait les contrôles, donc les
 * occasions d'en oublier un.
 *
 * L'ancienne photo est supprimée APRÈS l'enregistrement de la nouvelle. Dans
 * l'ordre inverse, un échec au milieu laisserait un profil sans avatar et un
 * fichier perdu.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const utilisateur = await currentUser();
  if (!utilisateur) {
    return NextResponse.json(
      { ok: false, message: 'Connectez-vous pour changer votre photo.' },
      { status: 401 },
    );
  }

  const budget = await consommer(BUDGETS.photo, utilisateur.id);
  if (!budget.allowed) {
    return NextResponse.json(
      {
        ok: false,
        message: `Trop de photos envoyées d’affilée. Réessayez dans ${delaiLisible(budget.resetAt)}.`,
      },
      { status: 429 },
    );
  }

  const annonce = Number(request.headers.get('content-length') ?? 0);
  if (Number.isFinite(annonce) && annonce > MAX_STORED_BYTES * 2) {
    // Refus AVANT lecture du corps : lire pour rejeter ensuite offrirait un
    // moyen simple de faire travailler le serveur pour rien.
    return NextResponse.json({ ok: false, message: 'Photo trop lourde.' }, { status: 413 });
  }

  let octets: Uint8Array;
  let type: string;
  try {
    const formulaire = await request.formData();
    const fichier = formulaire.get('photo');

    if (!(fichier instanceof File)) {
      return NextResponse.json({ ok: false, message: 'Aucune photo reçue.' }, { status: 400 });
    }

    octets = new Uint8Array(await fichier.arrayBuffer());
    type = fichier.type;
  } catch {
    return NextResponse.json({ ok: false, message: 'Corps de requête illisible.' }, { status: 400 });
  }

  const enregistre = await savePhoto(utilisateur.id, octets, type);
  if (!enregistre.ok) {
    return NextResponse.json({ ok: false, message: enregistre.message }, { status: 400 });
  }

  const ancien = await majAvatar(utilisateur.id, enregistre.path);
  if (ancien && ancien !== enregistre.path) {
    await deletePhoto(ancien).catch(() => undefined);
  }

  return NextResponse.json({ ok: true, chemin: enregistre.path });
}
