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

/**
 * Sixième panne silencieuse : la clé Stormglass sans garde-fou de quota.
 *
 * Le palier gratuit de Stormglass accorde une dizaine de requêtes par jour.
 * Le catalogue compte aujourd'hui plusieurs dizaines de spots, et chaque
 * construction du site en interroge un par spot. Sans `TIDE_REAL_SPOTS`, les
 * premières requêtes passent, les suivantes sont refusées pour dépassement —
 * et le repli, qui existe pour qu'une panne réseau ne casse pas le build, les
 * rattrape TOUTES en silence.
 *
 * Ce qu'on voit alors : une clé correctement posée, un déploiement réussi, et
 * « marées simulées » sur presque toutes les pages. Rien n'indique le quota.
 * On soupçonne la clé, on la régénère, on recommence.
 *
 * Le seuil est volontairement bas : au-delà d'une poignée de spots, un palier
 * gratuit ne suit plus, quel que soit le fournisseur.
 */
export const BUDGET_SANS_LIMITE_MAX_SPOTS = 8;

export function tideBudgetWarning(
  env: Readonly<Record<string, string | undefined>> = process.env,
  spotCount = 0,
): string | null {
  if (!env['STORMGLASS_API_KEY']?.trim()) return null;
  if (env['TIDE_PROVIDER'] === 'mock') return null;
  if (parseAllowedSpots(env['TIDE_REAL_SPOTS']).length > 0) return null;
  if (spotCount <= BUDGET_SANS_LIMITE_MAX_SPOTS) return null;

  return (
    `STORMGLASS_API_KEY est définie et TIDE_REAL_SPOTS ne l’est pas : les ${spotCount} spots ` +
    'passeront tous par Stormglass à chaque construction. Le palier gratuit accorde une ' +
    'dizaine de requêtes par jour — au-delà, le repli rend des marées SIMULÉES sans que ' +
    'rien ne le signale, et la clé paraîtra fautive. Définissez par exemple ' +
    'TIDE_REAL_SPOTS=pen-hat,la-torche,etretat, puis reconstruisez.'
  );
}
