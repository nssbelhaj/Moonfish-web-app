import { notFound } from 'next/navigation';
import type { Spot } from '@/data/schemas';
import { getSpotForecast, referenceNow, type SpotForecast } from '@/lib/forecast';
import { spots as spotRepository } from '@/lib/providers';

export interface RouteParams {
  country: string;
  region: string;
  slug: string;
}

/**
 * Résolution commune au layout et aux trois onglets.
 *
 * `getSpotForecast` est mémoïsé pour la durée de la requête : appeler cette
 * fonction depuis le layout PUIS depuis la page ne recalcule rien et, avec un
 * fournisseur réel, ne déclenche pas un second appel réseau.
 */
export async function resolveSpot(
  params: Promise<RouteParams>,
): Promise<{ spot: Spot; forecast: SpotForecast; now: Date }> {
  const { country, region, slug } = await params;
  const spot = await spotRepository.findByPath(country, region, slug);
  if (!spot) notFound();

  const now = referenceNow();
  return { spot, forecast: await getSpotForecast(spot, now), now };
}

/** Variante tolérante, pour `generateMetadata` qui ne doit pas provoquer de 404. */
export async function findSpot(params: Promise<RouteParams>): Promise<Spot | null> {
  const { country, region, slug } = await params;
  return spotRepository.findByPath(country, region, slug);
}

export async function spotStaticParams(): Promise<RouteParams[]> {
  const all = await spotRepository.list();
  return all.map((spot) => ({
    country: spot.countrySlug,
    region: spot.regionSlug,
    slug: spot.slug,
  }));
}
