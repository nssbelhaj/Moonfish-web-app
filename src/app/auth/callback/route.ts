import { NextResponse, type NextRequest } from 'next/server';

import { supabaseServer } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Retour du lien de connexion reçu par e-mail.
 *
 * Le lien porte un `code` à usage unique, échangé ici contre une session. Le
 * jeton n'apparaît donc jamais dans l'URL du navigateur : il ne finit ni dans
 * l'historique, ni dans un en-tête `Referer` envoyé à un tiers, ni dans les
 * journaux d'un serveur intermédiaire.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');

  const failure = (reason: string): NextResponse =>
    NextResponse.redirect(new URL(`/compte?erreur=${reason}`, url.origin));

  if (!code) return failure('lien-invalide');

  const client = await supabaseServer();
  if (!client) return failure('comptes-fermes');

  const { error } = await client.auth.exchangeCodeForSession(code);
  if (error) {
    console.error('[auth] échange du code impossible', error.message);
    // Message volontairement neutre : un lien peut être expiré, déjà utilisé ou
    // destiné à un autre navigateur, et distinguer ces cas renseignerait un
    // attaquant sur l'existence d'un compte.
    return failure('lien-expire');
  }

  /*
    `next` permet de revenir au spot d'où l'on venait. Il est vérifié : une
    redirection ouverte transformerait notre domaine en tremplin vers un site
    d'hameçonnage, avec la caution d'un lien envoyé par nous. Seuls les chemins
    internes commençant par une seule barre sont acceptés — « //ailleurs.tld »
    est une URL absolue déguisée.
  */
  const requested = url.searchParams.get('next') ?? '/compte';
  const safeNext = /^\/(?!\/)[^\s]*$/.test(requested) ? requested : '/compte';

  return NextResponse.redirect(new URL(safeNext, url.origin));
}
