import type { MarinePoint, Spot } from '@/data/schemas';
import type { DateRange, SourceMeta, Sourced, WeatherProvider } from './types';

/**
 * Enveloppe un fournisseur météo d'un repli.
 *
 * Deux raisons de faire ça plutôt que de laisser l'erreur remonter :
 *  - au build, une coupure réseau ne doit pas empêcher le site de se construire ;
 *  - en production, une panne d'Open-Meteo ne doit pas rendre 12 pages en 500.
 *
 * Le repli n'est JAMAIS silencieux. La source renvoyée repasse en `simulated`
 * et le dit explicitement, ce qui rallume le cadre pointillé et l'avertissement
 * de démonstration sur les pages concernées. Un mode dégradé qui se fait passer
 * pour un mode normal serait pire que la panne.
 */
export class WeatherProviderWithFallback implements WeatherProvider {
  constructor(
    private readonly primary: WeatherProvider,
    private readonly fallback: WeatherProvider,
  ) {}

  get source(): SourceMeta {
    return this.primary.source;
  }

  async getMarineSeries(spot: Spot, range: DateRange): Promise<Sourced<MarinePoint[]>> {
    try {
      return await this.primary.getMarineSeries(spot, range);
    } catch (error) {
      console.error(
        `[météo] ${this.primary.source.name} indisponible pour ${spot.slug}, repli sur les données simulées.`,
        error,
      );

      const degraded = await this.fallback.getMarineSeries(spot, range);

      return {
        ...degraded,
        source: {
          name: `Repli simulé — ${this.primary.source.name} injoignable`,
          kind: 'simulated',
          precision:
            'Le fournisseur réel n’a pas répondu. Les valeurs affichées sont générées et ne décrivent aucune condition réelle.',
        },
      };
    }
  }
}
