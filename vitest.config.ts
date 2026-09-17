import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    /**
     * Les tests sont hermétiques : aucun ne doit toucher le réseau.
     *
     * Sans cette ligne, `getSpotForecast` passait par le vrai fournisseur
     * Open-Meteo, échouait faute de connexion, et ne réussissait que grâce au
     * repli — c'est-à-dire qu'il testait le chemin de panne en croyant tester
     * le chemin nominal. Le fournisseur Open-Meteo est exercé séparément, avec
     * un `fetch` injecté.
     */
    env: {
      WEATHER_PROVIDER: 'mock',
      /*
        ─── Les marées aussi, et la clé est NEUTRALISÉE ──────────────────
        Seule la météo était forcée. Les marées, elles, partaient chez
        Stormglass dès qu'une `STORMGLASS_API_KEY` traînait dans
        l'environnement — ce qui est le cas sur toute machine où l'on
        développe la vraie configuration. Mesuré : une exécution de la suite
        consommait trois appels sur les dix du palier gratuit, et faisait
        donc RETOMBER le site en marées simulées pour la journée.

        La suite se disait « hermétique, aucun accès réseau » ; elle l'était
        pour la météo seulement. Vider la clé rend l'affirmation vraie quelle
        que soit la machine, au lieu de dépendre de ce que le développeur a
        dans son shell.
      */
      TIDE_PROVIDER: 'mock',
      STORMGLASS_API_KEY: '',
    },

    /**
     * Un fichier à la fois.
     *
     * Les tests d'intégration partagent une seule base MySQL, et chacun vide
     * les tables dans son `beforeEach`. Deux fichiers lancés en parallèle se
     * marchent dessus : l'un supprime les lignes que l'autre vient d'écrire,
     * et l'échec ressemble à un bug de dépôt — « attendu une ligne, reçu
     * zéro ». Constaté le jour où un second fichier d'intégration est apparu ;
     * huit à douze échecs, jamais les mêmes.
     *
     * Sérialiser TOUS les fichiers coûte quelques secondes aux tests unitaires,
     * mesurées et acceptées : une suite qui échoue au hasard vaut moins qu'une
     * suite lente. Le découpage par projets de Vitest aurait limité le coût
     * aux seuls fichiers d'intégration ; il n'a pas été retenu par la version
     * installée, et un réglage ignoré en silence est pire qu'un réglage
     * grossier.
     */
    fileParallelism: false,
  },
});
