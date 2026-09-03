import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { FavoriteButton } from '@/components/account/FavoriteButton';
import { SafetyBanner } from '@/components/spot/SafetyBanner';
import { BOTTOM_LABELS, EXPOSURE_LABELS, TECHNIQUE_LABELS } from '@/data/spots';
import { shelteredNearby } from '@/lib/geo';
import { spots as spotRepository } from '@/lib/providers';
import { absoluteUrl, spotPath } from '@/lib/routes';
import { findSpot, resolveSpot, spotStaticParams, type RouteParams } from './spot-page-data';

export const revalidate = 3600;

/** Les 12 spots sont pré-rendus, et avec eux les trois onglets de chacun. */
export const generateStaticParams = spotStaticParams;

/**
 * Métadonnées communes aux trois onglets. Chaque page les affine ensuite avec
 * son propre titre et sa propre description — Next fusionne, la page l'emporte.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}): Promise<Metadata> {
  const spot = await findSpot(params);
  if (!spot) return { title: 'Spot introuvable' };

  return {
    title: `${spot.name} — pêche du bord en ${spot.regionName}`,
    openGraph: { type: 'article', url: absoluteUrl(spotPath(spot)) },
  };
}

/**
 * Coquille commune aux onglets Live, Prévision et Analyse.
 *
 * Y vivent les éléments qui ne doivent JAMAIS dépendre de l'onglet consulté :
 * le bandeau de sécurité, l'identité du spot et l'avertissement de source. Une
 * alerte de danger qui ne s'afficherait que sur un onglet serait pire que pas
 * d'alerte du tout.
 */
export default async function SpotLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<RouteParams>;
}) {
  const { spot, forecast } = await resolveSpot(params);
  const current = forecast.current;
  const isDanger = current?.score.safety.level === 'danger';

  const allSpots = await spotRepository.list();
  const shelters = shelteredNearby(spot, allSpots, 20);

  const placeJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Place',
    name: spot.name,
    description: spot.summary,
    url: absoluteUrl(spotPath(spot)),
    geo: { '@type': 'GeoCoordinates', latitude: spot.lat, longitude: spot.lng },
    address: {
      '@type': 'PostalAddress',
      addressRegion: spot.regionName,
      addressCountry: spot.countryName === 'France' ? 'FR' : 'MA',
    },
    additionalProperty: [
      { '@type': 'PropertyValue', name: 'Exposition', value: EXPOSURE_LABELS[spot.exposure] },
      { '@type': 'PropertyValue', name: 'Type de fond', value: BOTTOM_LABELS[spot.bottom] },
      { '@type': 'PropertyValue', name: 'Espèces cibles', value: spot.species.join(', ') },
      {
        '@type': 'PropertyValue',
        name: 'Techniques praticables',
        value: spot.techniques.map((technique) => TECHNIQUE_LABELS[technique]).join(', '),
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(placeJsonLd) }}
      />

      {current && current.score.safety.level !== 'ok' && (
        <div className="mx-auto w-full max-w-shell px-4 pt-4 md:px-8">
          <SafetyBanner
            level={current.score.safety.level}
            message={current.score.safety.message}
            {...(shelters.length > 0
              ? { shelterHref: spotPath(shelters[0]!), shelterCount: shelters.length }
              : {})}
          />
          {isDanger && shelters.length === 0 && (
            <p className="mt-3 text-meta nums text-fg-muted">
              Aucun spot plus abrité du catalogue n’est à moins de 20 km. Consultez{' '}
              <Link href="/spots" className="underline decoration-dotted underline-offset-4">
                la liste complète
              </Link>{' '}
              ou reportez la sortie.
            </p>
          )}
        </div>
      )}

      <div className="mx-auto w-full max-w-shell px-4 pt-6 md:px-8 md:pt-10">
        <nav aria-label="Fil d’Ariane" className="text-meta nums text-fg-muted">
          <Link href="/spots" className="underline decoration-dotted underline-offset-4">
            Spots
          </Link>
          {' / '}
          <Link
            href={`/spots?pays=${spot.countrySlug}`}
            className="underline decoration-dotted underline-offset-4"
          >
            {spot.countryName}
          </Link>
          {' / '}
          <Link
            href={`/spots?region=${spot.regionSlug}`}
            className="underline decoration-dotted underline-offset-4"
          >
            {spot.regionName}
          </Link>
        </nav>

        {/*
          Le layout s'arrête au titre. Le résumé, les tags et l'avertissement de
          source vivent dans les onglets : sur un écran de 375, les empiler ici
          repoussait la navigation sous la ligne de flottaison, et l'utilisateur
          ne pouvait pas voir qu'il y avait autre chose que la page courante.
        */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <h1 className="font-serif text-h1 font-semibold">{spot.name}</h1>
          {/*
            Le bouton lit la session côté client : la page reste pré-rendue.
            Il n'apparaît qu'une fois l'état connu, pour ne pas changer de
            forme sous le doigt.
          */}
          <FavoriteButton spotSlug={spot.slug} spotPath={spotPath(spot)} />
        </div>
      </div>

      {children}
    </>
  );
}
