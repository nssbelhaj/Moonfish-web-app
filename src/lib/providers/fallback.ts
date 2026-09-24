import type { MarinePoint, Spot, TideEvent } from '@/data/schemas';
import { BudgetEpuise } from './marees/persistant';
import type { DateRange, SourceMeta, Sourced, TideProvider, WeatherProvider } from './types';

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
          degraded: true,
          precision:
            'Le fournisseur réel n’a pas répondu. Les valeurs affichées sont générées et ne décrivent aucune condition réelle.',
        },
      };
    }
  }
}

/**
 * Même contrat pour les marées.
 *
 * Le repli est ici plus lourd de conséquences que pour la météo : une heure de
 * pleine mer inventée peut mettre quelqu'un en danger sur un estran. Il repasse
 * donc lui aussi la source en `simulated`, ce qui rallume le cadre pointillé,
 * l'avertissement de démonstration et le renvoi vers le SHOM.
 */
export class TideProviderWithFallback implements TideProvider {
  constructor(
    private readonly primary: TideProvider,
    private readonly fallback: TideProvider,
  ) {}

  get source(): SourceMeta {
    return this.primary.source;
  }

  async getTideEvents(spot: Spot, range: DateRange): Promise<Sourced<TideEvent[]>> {
    try {
      return await this.primary.getTideEvents(spot, range);
    } catch (error) {
      const degraded = await this.fallback.getTideEvents(spot, range);

      /*
        Budget du jour épuisé : ce n'est PAS une panne, c'est le remplissage
        prévu des tables — huit points par jour, une semaine pour le
        catalogue. Le spot est simulé et le dit, mais sans le voyant
        « Interrompu », réservé aux vraies coupures : allumé sur trente-cinq
        pages pendant une semaine, il cesserait d'être regardé le jour où il
        compterait.
      */
      if (error instanceof BudgetEpuise) {
        console.info(`[marées] ${spot.slug} : ${error.message}`);
        return {
          ...degraded,
          source: {
            name: `Marées — simulées en attendant la table réelle`,
            kind: 'simulated',
            precision:
              'Le budget journalier de requêtes au fournisseur est épuisé ; la table réelle de ce spot sera demandée par la prochaine tâche d’entretien. D’ici là, les horaires affichés sont générés. Consultez maree.shom.fr.',
          },
        };
      }

      console.error(
        `[marées] ${this.primary.source.name} indisponible pour ${spot.slug}, repli sur les marées simulées.`,
        error,
      );

      return {
        ...degraded,
        source: {
          name: `Marées — repli simulé, ${this.primary.source.name} injoignable`,
          kind: 'simulated',
          degraded: true,
          precision:
            'Le fournisseur réel n’a pas répondu. Les horaires affichés sont générés et ne correspondent à aucune marée réelle. Consultez maree.shom.fr.',
        },
      };
    }
  }
}
