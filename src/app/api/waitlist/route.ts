import { NextResponse } from 'next/server';
import { waitlistInputSchema } from '@/data/schemas';
import { waitlist } from '@/lib/providers';

/** Le handler écrit sur disque : il ne peut pas être pré-rendu. */
export const dynamic = 'force-dynamic';

/**
 * Adresse IP de l'appelant.
 *
 * Derrière un proxy, `x-forwarded-for` est la seule source disponible — et elle
 * est falsifiable. Le limiteur de débit qu'elle alimente n'est donc qu'une
 * barrière contre le bruit, pas contre un attaquant. C'est assumé pour un MVP
 * sans base ; ça ne le sera plus ensuite.
 */
function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() ?? 'inconnu';
  return request.headers.get('x-real-ip') ?? 'inconnu';
}

export async function POST(request: Request): Promise<NextResponse> {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, message: 'Corps de requête illisible.' },
      { status: 400 },
    );
  }

  const parsed = waitlistInputSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        message: parsed.error.issues[0]?.message ?? 'Adresse e-mail invalide.',
      },
      { status: 422 },
    );
  }

  const result = await waitlist.add(parsed.data, { ip: clientIp(request) });

  if (!result.ok) {
    const responses = {
      invalid: { status: 422, message: 'Adresse e-mail invalide.' },
      'rate-limited': {
        status: 429,
        message: 'Trop de tentatives. Réessayez dans un quart d’heure.',
      },
      'storage-error': {
        status: 503,
        message: 'Enregistrement impossible pour le moment. Réessayez plus tard.',
      },
    } as const;

    const response = responses[result.reason];
    return NextResponse.json({ ok: false, message: response.message }, { status: response.status });
  }

  return NextResponse.json({ ok: true, alreadyRegistered: result.alreadyRegistered });
}

/** Toute autre méthode est refusée explicitement plutôt que de renvoyer un 404 trompeur. */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    { ok: false, message: 'Utilisez POST pour vous inscrire.' },
    { status: 405, headers: { allow: 'POST' } },
  );
}
