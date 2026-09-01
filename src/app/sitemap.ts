import type { MetadataRoute } from 'next';
import { listGuides } from '@/lib/guides';
import { spots as spotRepository } from '@/lib/providers';
import { absoluteUrl, spotPath } from '@/lib/routes';

/**
 * Le sitemap se génère depuis les mêmes sources que les pages : ajouter un spot
 * ou un guide suffit à l'y faire apparaître, sans liste à maintenir en double.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [allSpots, guides] = await Promise.all([spotRepository.list(), listGuides()]);
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    { url: absoluteUrl('/'), lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: absoluteUrl('/spots'), lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: absoluteUrl('/guides'), lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: absoluteUrl('/carte'), lastModified: now, changeFrequency: 'hourly', priority: 0.7 },
    { url: absoluteUrl('/donnees'), lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
  ];

  // Chaque spot expose trois pages réelles, pas trois onglets commutés : elles
  // répondent à des recherches distinctes (« conditions à X », « prévision 7
  // jours X », « techniques de pêche à X ») et méritent chacune leur entrée.
  const spotPages: MetadataRoute.Sitemap = allSpots.flatMap((spot) => [
    {
      url: absoluteUrl(spotPath(spot)),
      lastModified: now,
      changeFrequency: 'hourly' as const,
      priority: 0.9,
    },
    {
      url: absoluteUrl(`${spotPath(spot)}/prevision`),
      lastModified: now,
      changeFrequency: 'daily' as const,
      priority: 0.8,
    },
    {
      url: absoluteUrl(`${spotPath(spot)}/analyse`),
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    },
  ]);

  // Les combinaisons de filtres réellement peuplées sont indexables : ce sont
  // des pages de destination utiles (« spots de surfcasting en Bretagne »).
  const regionPages: MetadataRoute.Sitemap = [
    ...new Set(allSpots.map((spot) => spot.regionSlug)),
  ].map((regionSlug) => ({
    url: absoluteUrl(`/spots?region=${regionSlug}`),
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.6,
  }));

  const guidePages: MetadataRoute.Sitemap = guides.map((guide) => ({
    url: absoluteUrl(`/guides/${guide.slug}`),
    lastModified: new Date(guide.published),
    changeFrequency: 'yearly',
    priority: 0.6,
  }));

  return [...staticPages, ...spotPages, ...regionPages, ...guidePages];
}
