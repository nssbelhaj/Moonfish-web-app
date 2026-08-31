import type { Spot } from '@/data/schemas';

const EARTH_RADIUS_KM = 6371;

/** Distance orthodromique entre deux points, en kilomètres. */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (deg: number): number => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

const EXPOSURE_RANK: Record<Spot['exposure'], number> = {
  abrite: 0,
  'semi-abrite': 1,
  expose: 2,
  'tres-expose': 3,
};

/**
 * Spots plus abrités que celui-ci, dans un rayon donné.
 *
 * Sert le CTA de repli obligatoire du bandeau de danger (handoff §3). La
 * distance est calculée pour de vrai : si le résultat est vide, l'interface le
 * dit au lieu d'annoncer un nombre inventé.
 */
export function shelteredNearby(spot: Spot, all: readonly Spot[], radiusKm = 20): Spot[] {
  return all
    .filter((candidate) => candidate.slug !== spot.slug)
    .filter((candidate) => EXPOSURE_RANK[candidate.exposure] < EXPOSURE_RANK[spot.exposure])
    .map((candidate) => ({ candidate, km: distanceKm(spot, candidate) }))
    .filter((entry) => entry.km <= radiusKm)
    .sort((a, b) => a.km - b.km)
    .map((entry) => entry.candidate);
}
