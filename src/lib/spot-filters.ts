import type { Spot } from '@/data/schemas';
import { spotBottomSchema, spotTypeSchema } from '@/data/schemas';

/**
 * Filtres de la page /spots.
 *
 * L'état vit ENTIÈREMENT dans l'URL : c'est partageable entre pêcheurs et
 * indexable (« spot surfcasting sable Finistère », handoff §5). Ce module est
 * le seul endroit qui sait lire et écrire ces paramètres.
 */
export interface SpotFilters {
  country: string | null;
  region: string | null;
  type: string | null;
  bottom: string | null;
}

export const EMPTY_FILTERS: SpotFilters = { country: null, region: null, type: null, bottom: null };

function firstValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value && value.length > 0 ? value : null;
}

export function parseFilters(
  params: Record<string, string | string[] | undefined>,
  spots: readonly Spot[],
): SpotFilters {
  const country = firstValue(params.pays);
  const region = firstValue(params.region);
  const type = firstValue(params.type);
  const bottom = firstValue(params.fond);

  // Une valeur inconnue est ignorée plutôt que de rendre une liste vide sans
  // explication : /spots?pays=narnia doit afficher les 12 spots, pas une page morte.
  return {
    country: spots.some((spot) => spot.countrySlug === country) ? country : null,
    region: spots.some((spot) => spot.regionSlug === region) ? region : null,
    type: spotTypeSchema.safeParse(type).success ? type : null,
    bottom: spotBottomSchema.safeParse(bottom).success ? bottom : null,
  };
}

export function applyFilters(spots: readonly Spot[], filters: SpotFilters): Spot[] {
  return spots.filter(
    (spot) =>
      (filters.country === null || spot.countrySlug === filters.country) &&
      (filters.region === null || spot.regionSlug === filters.region) &&
      (filters.type === null || spot.type === filters.type) &&
      (filters.bottom === null || spot.bottom === filters.bottom),
  );
}

export function filtersToSearchParams(filters: SpotFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.country) params.set('pays', filters.country);
  if (filters.region) params.set('region', filters.region);
  if (filters.type) params.set('type', filters.type);
  if (filters.bottom) params.set('fond', filters.bottom);
  return params;
}

export function hasAnyFilter(filters: SpotFilters): boolean {
  return Object.values(filters).some((value) => value !== null);
}

/** Libellé lisible de la sélection courante, réutilisé dans le titre et la meta description. */
export function describeFilters(
  filters: SpotFilters,
  spots: readonly Spot[],
  labels: { type: Record<string, string>; bottom: Record<string, string> },
): string | null {
  const parts: string[] = [];
  if (filters.type) parts.push(labels.type[filters.type]?.toLowerCase() ?? filters.type);
  if (filters.bottom) parts.push(`fond de ${labels.bottom[filters.bottom]?.toLowerCase() ?? filters.bottom}`);
  if (filters.region) {
    parts.push(`en ${spots.find((spot) => spot.regionSlug === filters.region)?.regionName ?? filters.region}`);
  } else if (filters.country) {
    const name = spots.find((spot) => spot.countrySlug === filters.country)?.countryName;
    parts.push(name === 'Maroc' ? 'au Maroc' : `en ${name ?? filters.country}`);
  }
  return parts.length > 0 ? parts.join(' ') : null;
}
