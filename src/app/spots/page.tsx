import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { SpotFilters } from '@/components/forms/SpotFilters';
import { NearbySpots } from '@/components/spot/NearbySpots';
import { SpotResults, SpotResultsSkeleton } from '@/components/spot/SpotResults';
import { Section } from '@/components/ui/Section';
import { BOTTOM_LABELS, CATALOGUE, SPOT_TYPE_LABELS, TECHNIQUE_LABELS } from '@/data/spots';
import { spots as spotRepository } from '@/lib/providers';
import { absoluteUrl, spotPath } from '@/lib/routes';
import {
  applyFilters,
  describeFilters,
  filtersToSearchParams,
  hasAnyFilter,
  parseFilters,
  toFacette,
} from '@/lib/spot-filters';

export const revalidate = 3600;

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * Le titre et la description suivent la sélection : « Spots de pêche du bord sur
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
    technique: TECHNIQUE_LABELS,
  });

  const canonicalQuery = filtersToSearchParams(filters).toString();
  const canonical = absoluteUrl(canonicalQuery ? `/spots?${canonicalQuery}` : '/spots');

  if (!description) {
    return {
      title: `Les ${all.length} spots de pêche du bord suivis par Luna Marea`,
      description: `${all.length} spots ${CATALOGUE.etendue} : score du créneau en cours, prochaine bonne fenêtre, marée et vent. Filtrables par pays, région, technique — surfcasting, lancer-ramener, rockfishing, shore-jigging, pêche à pied — et type de fond.`,
      alternates: { canonical },
    };
  }

  return {
    title: `Spots de pêche ${description}`,
    description: `${matching.length} spot${matching.length > 1 ? 's' : ''} ${description} suivi${matching.length > 1 ? 's' : ''} par Luna Marea : score du créneau en cours, prochaine fenêtre favorable, marée, vent et houle.`,
    alternates: { canonical },
  };
}

export default async function SpotsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const all = await spotRepository.list();
  const filters = parseFilters(await searchParams, all);
  const matching = applyFilters(all, filters);

  const description = describeFilters(filters, all, {
    type: SPOT_TYPE_LABELS,
    bottom: BOTTOM_LABELS,
    technique: TECHNIQUE_LABELS,
  });

  return (
    <>
      <div className="mx-auto w-full max-w-shell px-4 pt-8 md:px-8 md:pt-12">
        <h1 className="font-serif text-h1 font-semibold">
          {description ? `Spots de pêche ${description}` : `Les ${all.length} spots suivis par Luna Marea`}
        </h1>
        <p className="mt-3 max-w-prose text-body text-fg-muted">
          Le classement suit le score du créneau en cours. Filtrez par technique — surfcasting,
          lancer-ramener, rockfishing, shore-jigging, pêche à pied — ou par région. Les filtres sont
          écrits dans l’adresse de la page : elle est partageable telle quelle.
        </p>
      </div>

      <Section>
        {/*
          Bloc de proximité AVANT les filtres : c'est la question la plus
          fréquente (« qu'y a-t-il près de moi ? ») et la plus vite répondue.
          Il ne demande rien tant qu'on ne clique pas, et la position ne quitte
          pas le navigateur.
        */}
        <div className="mb-8 max-w-prose">
          <NearbySpots
            spots={all.map((spot) => ({
              slug: spot.slug,
              name: spot.name,
              regionLabel: spot.regionName,
              path: spotPath(spot),
              lat: spot.lat,
              lng: spot.lng,
            }))}
          />
        </div>

        <h2 className="sr-only">Filtrer les spots</h2>
        <SpotFilters
          initial={filters}
          spots={all.map(toFacette)}
          libelles={{ type: SPOT_TYPE_LABELS, fond: BOTTOM_LABELS, technique: TECHNIQUE_LABELS }}
        />

        {/*
          Les deux états sont rendus, l'un des deux masqué : le filtre côté
          client bascule entre eux sans recharger. `data-vide` et `data-liste`
          sont les poignées qu'il actionne.
        */}
        <div className="mt-6 surface px-4 py-8" data-vide="" hidden={matching.length > 0}>
          <p className="text-body font-600">Aucun spot ne correspond à cette combinaison.</p>
          <p className="mt-2 max-w-prose text-body text-fg-muted">
            Le catalogue compte {all.length} spots pour l’instant. Retirez un filtre, ou repartez de
            la liste complète.
          </p>
          <Link
            href="/spots"
            className="mt-4 inline-flex min-h-[48px] items-center rounded-ctl border border-edge-strong px-4 font-600"
          >
            Voir les {all.length} spots
          </Link>
        </div>

        <h2 className="mt-8 font-serif text-h2 font-semibold" data-liste="" hidden={matching.length === 0}>
          <span data-compteur="">{matching.length}</span> spot{matching.length > 1 ? 's' : ''}
          {description ? ` ${description}` : ''}
        </h2>
        {/* Le calcul des scores est diffusé en flux : la coquille de la page,
            métadonnées comprises, part sans l'attendre. */}
        <Suspense fallback={<SpotResultsSkeleton count={matching.length} />}>
          <SpotResults spots={all} visibles={new Set(matching.map((spot) => spot.slug))} />
        </Suspense>

        {hasAnyFilter(filters) && (
          <p className="mt-6 text-meta nums text-fg-faint" data-numeric="">
            {matching.length} spot{matching.length > 1 ? 's' : ''} sur {all.length}.
          </p>
        )}
      </Section>
    </>
  );
}
