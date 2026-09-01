import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  typescript: { ignoreBuildErrors: false },
  eslint: { ignoreDuringBuilds: false },

  /**
   * Métadonnées bloquantes pour TOUS les clients, pas seulement pour les robots
   * réputés incapables de lire un flux.
   *
   * Par défaut, Next diffuse les métadonnées des pages dynamiques : sur /spots,
   * le <title> et la <meta name="description"> arrivaient après la coquille et
   * finissaient dans le <body> plutôt que dans le <head>. Googlebot exécute le
   * JavaScript et s'en accommode, mais tout ce qui ne le fait pas — aperçus de
   * liens, outils d'audit, robots secondaires — voyait une page sans description.
   *
   * `htmlLimitedBots` est le seul levier exposé : une expression qui accepte
   * tout revient à désactiver la diffusion en flux des métadonnées. Le coût est
   * un léger retard du premier octet sur les pages dynamiques ; ici
   * `generateMetadata` ne lit qu'une liste en mémoire, il est donc nul en pratique.
   * À réévaluer le jour où les métadonnées dépendront d'un appel réseau.
   */
  htmlLimitedBots: /.*/,

  /**
   * Photos de prises servies depuis le stockage Supabase.
   *
   * Le motif est construit à partir de la variable d'environnement plutôt
   * qu'écrit en dur : chaque projet Supabase a son propre sous-domaine, et un
   * motif figé casserait le rendu d'images sur tout déploiement autre que le
   * nôtre. Sans projet configuré, la liste reste vide — et aucune image
   * distante n'est autorisée, ce qui est exactement l'état du site aujourd'hui.
   */
  images: {
    remotePatterns: supabaseImagePattern(),
  },
};

function supabaseImagePattern(): { protocol: 'https'; hostname: string; pathname: string }[] {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!raw) return [];

  try {
    const { hostname } = new URL(raw);
    return [{ protocol: 'https', hostname, pathname: '/storage/v1/object/public/**' }];
  } catch {
    console.warn(`[config] NEXT_PUBLIC_SUPABASE_URL inexploitable ("${raw}") : photos désactivées.`);
    return [];
  }
}

export default nextConfig;
