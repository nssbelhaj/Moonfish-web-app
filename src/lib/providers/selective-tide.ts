import type { Spot, TideEvent } from '@/data/schemas';
import type { DateRange, SourceMeta, Sourced, TideProvider } from './types';

/**
 * Restreint le fournisseur réel de marées à une liste de spots.
 *
 * Raison d'être : le palier gratuit de Stormglass est à dix appels par jour, et
 * un catalogue de douze spots en demande davantage — le fournisseur est
 * ponctuel, une requête par point, il n'y a pas de requête groupée. Plutôt que
 * de laisser le quota se vider dans l'ordre arbitraire du build et rendre
 * quelques spots réels au hasard, on choisit lesquels.
 *
 * Les spots écartés reçoivent le modèle de démonstration TEL QUEL, sans
 * `degraded` : ce n'est pas une panne, c'est une configuration. Ils gardent donc
 * leur cadre pointillé et leur mention « Simulé », et n'allument pas le voyant
 * « Interrompu » qui, lui, doit rester réservé aux vraies coupures.
 */
export class SelectiveTideProvider implements TideProvider {
  private readonly allowed: ReadonlySet<string>;

  constructor(
    private readonly real: TideProvider,
    private readonly fallback: TideProvider,
    allowedSlugs: readonly string[],
  ) {
    this.allowed = new Set(allowedSlugs);
  }

  /** La source DÉCLARÉE reste celle du fournisseur réel : c'est lui qui est configuré. */
  get source(): SourceMeta {
    return this.real.source;
  }

  getTideEvents(spot: Spot, range: DateRange): Promise<Sourced<TideEvent[]>> {
    return this.allowed.has(spot.slug)
      ? this.real.getTideEvents(spot, range)
      : this.fallback.getTideEvents(spot, range);
  }
}

/** Liste de slugs lue dans `TIDE_REAL_SPOTS`. Vide = aucune restriction. */
export function parseAllowedSpots(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((slug) => slug.trim())
    .filter((slug) => slug.length > 0);
}
