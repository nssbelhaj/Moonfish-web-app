import type { Spot } from '@/data/schemas';
import { fishingTechniqueSchema, spotBottomSchema, spotTypeSchema } from '@/data/schemas';

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
  technique: string | null;
}

export const EMPTY_FILTERS: SpotFilters = {
  country: null,
  region: null,
  type: null,
  bottom: null,
  technique: null,
};

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
  const technique = firstValue(params.technique);

  // Une valeur inconnue est ignorée plutôt que de rendre une liste vide sans
  // explication : /spots?pays=narnia doit afficher tout le catalogue, pas une page morte.
  return {
    country: spots.some((spot) => spot.countrySlug === country) ? country : null,
    region: spots.some((spot) => spot.regionSlug === region) ? region : null,
    type: spotTypeSchema.safeParse(type).success ? type : null,
    bottom: spotBottomSchema.safeParse(bottom).success ? bottom : null,
    technique: fishingTechniqueSchema.safeParse(technique).success ? technique : null,
  };
}

export function applyFilters(spots: readonly Spot[], filters: SpotFilters): Spot[] {
  return spots.filter(
    (spot) =>
      (filters.country === null || spot.countrySlug === filters.country) &&
      (filters.region === null || spot.regionSlug === filters.region) &&
      (filters.type === null || spot.type === filters.type) &&
      (filters.bottom === null || spot.bottom === filters.bottom) &&
      (filters.technique === null ||
        spot.techniques.includes(filters.technique as Spot['techniques'][number])),
  );
}

export function filtersToSearchParams(filters: SpotFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.country) params.set('pays', filters.country);
  if (filters.region) params.set('region', filters.region);
  if (filters.type) params.set('type', filters.type);
  if (filters.bottom) params.set('fond', filters.bottom);
  if (filters.technique) params.set('technique', filters.technique);
  return params;
}

export function hasAnyFilter(filters: SpotFilters): boolean {
  return Object.values(filters).some((value) => value !== null);
}

/** Libellé lisible de la sélection courante, réutilisé dans le titre et la meta description. */
export function describeFilters(
  filters: SpotFilters,
  spots: readonly Spot[],
  labels: {
    type: Record<string, string>;
    bottom: Record<string, string>;
    technique: Record<string, string>;
  },
): string | null {
  const parts: string[] = [];
  if (filters.technique) {
    parts.push(`au ${labels.technique[filters.technique]?.toLowerCase() ?? filters.technique}`);
  }
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

/* ────────────────────────────────────────────────────────────────────────────
   Facettes : la même règle que `applyFilters`, mais sur une forme LÉGÈRE du
   spot, envoyée au navigateur pour filtrer sans recharger.
   ──────────────────────────────────────────────────────────────────────────── */

export interface FacetteSpot {
  slug: string;
  pays: string;
  paysNom: string;
  region: string;
  regionNom: string;
  type: string;
  fond: string;
  techniques: readonly string[];
}

export function toFacette(spot: Spot): FacetteSpot {
  return {
    slug: spot.slug,
    pays: spot.countrySlug,
    paysNom: spot.countryName,
    region: spot.regionSlug,
    regionNom: spot.regionName,
    type: spot.type,
    fond: spot.bottom,
    techniques: spot.techniques,
  };
}

export type FiltreCle = keyof SpotFilters;

/**
 * Le spot passe-t-il les filtres — en ignorant, si demandé, l'un d'eux ?
 *
 * Ignorer un filtre sert à compter les options de SA facette contre les
 * autres : c'est ce qui fait qu'après avoir choisi « Maroc », « Bretagne »
 * affiche 0 et non 10.
 */
export function correspond(spot: FacetteSpot, f: SpotFilters, sauf: FiltreCle | null = null): boolean {
  return (
    (sauf === 'country' || f.country === null || spot.pays === f.country) &&
    (sauf === 'region' || f.region === null || spot.region === f.region) &&
    (sauf === 'type' || f.type === null || spot.type === f.type) &&
    (sauf === 'bottom' || f.bottom === null || spot.fond === f.bottom) &&
    (sauf === 'technique' || f.technique === null || spot.techniques.includes(f.technique))
  );
}

export interface OptionFacette {
  value: string;
  label: string;
  count: number;
}

/** Options d'une facette, comptées contre les AUTRES filtres actifs, triées en français. */
export function optionsFacette(
  spots: readonly FacetteSpot[],
  f: SpotFilters,
  cle: FiltreCle,
  valeurs: (s: FacetteSpot) => readonly (readonly [string, string])[],
): OptionFacette[] {
  const comptes = new Map<string, OptionFacette>();
  for (const spot of spots) {
    const compte = correspond(spot, f, cle);
    for (const [value, label] of valeurs(spot)) {
      const o = comptes.get(value) ?? { value, label, count: 0 };
      if (compte) o.count += 1;
      comptes.set(value, o);
    }
  }
  return [...comptes.values()].sort((a, b) => a.label.localeCompare(b.label, 'fr'));
}
