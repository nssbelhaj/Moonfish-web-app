import type { Spot } from '@/data/schemas';

/** URL canonique d'un spot. Slugs sans accent, lisibles, stables. */
export function spotPath(spot: Pick<Spot, 'countrySlug' | 'regionSlug' | 'slug'>): string {
  return `/spots/${spot.countrySlug}/${spot.regionSlug}/${spot.slug}`;
}

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://moonfish.fish').replace(
  /\/$/,
  '',
);

export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}
