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
};

export default nextConfig;
