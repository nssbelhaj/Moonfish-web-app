import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

import { SUPABASE_CONFIG } from '@/lib/supabase/config';

/**
 * Rafraîchissement de la session, et rien d'autre.
 *
 * Un composant serveur ne peut pas écrire de cookie ; c'est donc ici, et
 * uniquement ici, que le jeton d'accès est renouvelé et reposé. Sans ce
 * passage, une session se périmerait au bout d'une heure et l'utilisateur
 * serait déconnecté en pleine saisie.
 *
 * Ce que ce middleware ne fait PAS : protéger des routes. Aucune page de ce
 * site n'est réservée — `/compte` s'affiche connecté ou non, avec un contenu
 * différent — et la véritable barrière est la sécurité au niveau des lignes
 * dans la base. Un middleware qui « protège » une page laisse croire que
 * l'autorisation vit dans le routeur, alors qu'elle doit vivre dans la donnée.
 */
export async function middleware(request: NextRequest) {
  if (SUPABASE_CONFIG === null) return NextResponse.next();

  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(toSet) {
        for (const { name, value } of toSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of toSet) response.cookies.set(name, value, options);
      },
    },
  });

  // Cet appel est le rafraîchissement : il valide le jeton auprès de Supabase
  // et déclenche `setAll` quand un nouveau est émis.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  /*
    Tout sauf les fichiers statiques et les images.

    Les inclure ferait tourner une vérification de session sur chaque police et
    chaque icône : autant d'allers-retours réseau inutiles, sur les requêtes
    précisément qui doivent être les plus rapides de la page.
  */
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:png|jpg|jpeg|svg|webp|ico|woff2?)$).*)'],
};
