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
    env: { WEATHER_PROVIDER: 'mock' },
  },
});
