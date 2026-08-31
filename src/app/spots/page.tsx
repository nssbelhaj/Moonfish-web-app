import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { SpotFilters, type FilterOption } from '@/components/forms/SpotFilters';
import { SpotResults, SpotResultsSkeleton } from '@/components/spot/SpotResults';
import { Section } from '@/components/ui/Section';
import { BOTTOM_LABELS, SPOT_TYPE_LABELS } from '@/data/spots';
import type { Spot } from '@/data/schemas';
import { spots as spotRepository } from '@/lib/providers';
import { absoluteUrl } from '@/lib/routes';
import {
  applyFilters,
  describeFilters,
  filtersToSearchParams,
  hasAnyFilter,
  parseFilters,
} from '@/lib/spot-filters';

export const revalidate = 3600;

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * Le titre et la description suivent la sélection : « Spots de surfcasting sur
 * fond de sable en Bretagne » est une page utile et indexable, pas une variante
 * templatisée du même texte.
 */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}): Promise<Metadata> {
  const all = await spotRepository.list();
  const filters = parseFilters(await searchParams, all);
  const matching = applyFilters(all, filters);
  const description = describeFilters(filters, all, {
    type: SPOT_TYPE_LABELS,
    bottom: BOTTOM_LABELS,
  });

  const canonicalQuery = filtersToSearchParams(filters).toString();
  const canonical = absoluteUrl(canonicalQuery ? `/spots?${canonicalQuery}` : '/spots');

  if (!description) {
    return {
      title: 'Les 12 spots de surfcasting suivis par Moonfish',
      description:
        'Bretagne, Normandie, Hauts-de-France, Nouvelle-Aquitaine, Occitanie et Souss-Massa : score du créneau en cours, prochaine bonne fenêtre, marée et vent pour chaque spot.',
      alternates: { canonical },
    };
  }

  return {
    title: `Spots de surfcasting ${description}`,
    description: `${matching.length} spot${matching.length > 1 ? 's' : ''} ${description} suivi${matching.length > 1 ? 's' : ''} par Moonfish : score du créneau en cours, prochaine fenêtre favorable, marée, vent et houle.`,
    alternates: { canonical },
  };
}

function countBy(spots: readonly Spot[], key: (spot: Spot) => string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const spot of spots) {
    const value = key(spot);
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}

function toOptions(
  counts: Map<string, number>,
  label: (value: string) => string,
): FilterOption[] {
  return [...counts.entries()]
    .map(([value, count]) => ({ value, label: label(value), count }))
    .sort((a, b) => a.label.localeCompare(b.label, 'fr'));
}

export default async function SpotsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const all = await spotRepository.list();
  const filters = parseFilters(await searchParams, all);
  const matching = applyFilters(all, filters);

  const nameFor = (spots: readonly Spot[], slugKey: 'countrySlug' | 'regionSlug', nameKey: 'countryName' | 'regionName') =>
    (value: string): string => spots.find((spot) => spot[slugKey] === value)?.[nameKey] ?? value;

  const description = describeFilters(filters, all, {
    type: SPOT_TYPE_LABELS,
    bottom: BOTTOM_LABELS,
  });

  return (
    <>
      <div className="mx-auto w-full max-w-shell px-4 pt-8 md:px-8 md:pt-12">
        <h1 className="text-h1 font-700">
          {description ? `Spots de surfcasting ${description}` : 'Les 12 spots suivis par Moonfish'}
        </h1>
        <p className="mt-3 max-w-measure text-body text-fg-muted">
          Le classement suit le score du créneau en cours. Les filtres sont écrits dans l’adresse de
          la page : elle est partageable telle quelle.
        </p>
      </div>

      <Section>
        <h2 className="sr-only">Filtrer les spots</h2>
        <SpotFilters
          filters={filters}
          countries={toOptions(
            countBy(all, (spot) => spot.countrySlug),
            nameFor(all, 'countrySlug', 'countryName'),
          )}
          regions={toOptions(
            countBy(all, (spot) => spot.regionSlug),
            nameFor(all, 'regionSlug', 'regionName'),
          )}
          types={toOptions(countBy(all, (spot) => spot.type), (value) => SPOT_TYPE_LABELS[value as Spot['type']] ?? value)}
          bottoms={toOptions(countBy(all, (spot) => spot.bottom), (value) => BOTTOM_LABELS[value as Spot['bottom']] ?? value)}
          total={matching.length}
        />

        {matching.length === 0 ? (
          <div className="mt-6 rounded-card border border-edge bg-card px-4 py-8">
            <p className="text-h3 font-600">Aucun spot ne correspond à cette combinaison.</p>
            <p className="mt-2 max-w-measure text-body text-fg-muted">
              Le catalogue compte 12 spots pour l’instant. Retirez un filtre, ou repartez de la
              liste complète.
            </p>
            <Link
              href="/spots"
              className="mt-4 inline-flex min-h-[48px] items-center rounded-input border border-edge-strong px-4 font-600"
            >
              Voir les 12 spots
            </Link>
          </div>
        ) : (
          <>
            <h2 className="mt-8 text-h2 font-600">
              {matching.length} spot{matching.length > 1 ? 's' : ''}
              {description ? ` ${description}` : ''}
            </h2>
            {/* Le calcul des scores est diffusé en flux : la coquille de la page,
                métadonnées comprises, part sans l'attendre. */}
            <Suspense fallback={<SpotResultsSkeleton count={matching.length} />}>
              <SpotResults spots={matching} />
            </Suspense>
          </>
        )}

        {hasAnyFilter(filters) && (
          <p className="mt-6 font-mono text-data text-fg-dim" data-numeric="">
            {matching.length} spot{matching.length > 1 ? 's' : ''} sur {all.length}.
          </p>
        )}
      </Section>
    </>
  );
}
