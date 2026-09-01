import { NextResponse } from 'next/server';

import { contributions } from '@/lib/providers';
import { currentUser } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Droit d'accès et de portabilité : tout ce que nous détenons sur un compte,
 * en un fichier JSON lisible par une machine comme par une personne.
 *
 * Le RGPD demande un « format structuré, couramment utilisé et lisible par
 * machine ». Un JSON indenté remplit les trois, sans outil ni compte à créer
 * ailleurs — et il se relit dans n'importe quel éditeur de texte.
 */
export async function GET(): Promise<NextResponse> {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, message: 'Connectez-vous pour exporter vos données.' },
      { status: 401 },
    );
  }

  const result = await contributions.exportAccount(user.id, user.email);
  if (!result.ok) {
    return NextResponse.json({ ok: false, message: result.message }, { status: 503 });
  }

  const stamp = new Date().toISOString().slice(0, 10);

  return new NextResponse(JSON.stringify(result.data, null, 2), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': `attachment; filename="moonfish-donnees-${stamp}.json"`,
      // Un export personnel n'a rien à faire dans un cache, quel qu'il soit.
      'cache-control': 'no-store, private',
    },
  });
}
