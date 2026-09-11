import type { NextConfig } from 'next';

/**
 * Horodatage de construction, posé par le script `build` AVANT toute chose.
 *
 * Il ne peut pas être calculé ici : Next charge ce fichier PLUSIEURS FOIS
 * pendant une même construction, et un `new Date()` à cet endroit rendait
 * une valeur différente à chaque chargement. Mesuré : une seconde d'écart
 * entre l'en-tête de réponse et la valeur vue par l'application, alors que
 * le diagnostic affirmait leur égalité.
 *
 * Le shell le calcule une fois, avant de lancer `next build` ; les deux
 * lecteurs partagent donc forcément la même valeur.
 *
 * Absent, il vaut « inconnue » — ce qui arrive si quelqu'un lance
 * `next build` directement au lieu de `npm run build`. Le diagnostic le dit
 * alors, plutôt que d'afficher un horodatage qui ne voudrait rien dire.
 */
const BUILD_STAMP = process.env.LUNA_BUILD ?? 'inconnue';

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
   * AUCUNE image distante n'est autorisée, et c'est délibéré.
   *
   * Les photos de prises sont servies par `/api/photos/...`, depuis notre
   * propre origine : le fichier vit hors du répertoire de l'application et
   * transite par une route qui vérifie le chemin. Rien ne part vers un tiers.
   *
   * Cette liste vide est donc une garantie, pas un oubli : c'est ce que le
   * test de vie privée vérifie quand il affirme que le navigateur ne joint
   * aucun hôte extérieur. Y ajouter un motif rouvrirait ce chemin.
   */
  images: {
    remotePatterns: [],
  },

  /** Remplacée littéralement à la compilation, donc figée avec le build. */
  env: { LUNA_BUILD: BUILD_STAMP },

  /**
   * En-tête d'empreinte de construction, sur toutes les réponses.
   *
   * `headers()` est évaluée à la COMPILATION et sérialisée dans le manifeste
   * des routes : la valeur servie est donc bien celle du build, pas celle du
   * démarrage. C'est ce qui permet de distinguer « le correctif n'est pas
   * déployé » de « le correctif est déployé et échoue » — deux situations
   * qui produisent exactement le même symptôme à l'écran.
   */
  async headers() {
    return [
      {
        source: '/:chemin*',
        headers: [{ key: 'x-luna-marea-build', value: BUILD_STAMP }],
      },
    ];
  },
};

export default nextConfig;
