import type { MetadataRoute } from 'next';
import { LEGAL_UPDATED } from '@/data/legal';
import { paysPath } from '@/data/pays';
import { REGIONS, regionPath } from '@/data/regions';
import { PAYS } from '@/data/spots';
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
    { url: absoluteUrl('/marees/coefficients'), lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: absoluteUrl('/donnees'), lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
    {
      url: absoluteUrl('/mentions-legales'),
      lastModified: new Date(LEGAL_UPDATED),
      changeFrequency: 'yearly',
      priority: 0.2,
    },
    {
      url: absoluteUrl('/confidentialite'),
      lastModified: new Date(LEGAL_UPDATED),
      changeFrequency: 'yearly',
      priority: 0.2,
    },
  ];

  // Une page par pays : c'est la porte d'entrée « pêche du bord en France »,
  // et la seule qui dise ce qui change d'un pays à l'autre.
  const paysPages: MetadataRoute.Sitemap = PAYS.map((pays) => ({
    url: absoluteUrl(paysPath(pays.slug)),
    lastModified: now,
    changeFrequency: 'hourly' as const,
    priority: 0.9,
  }));

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

  // Une page par région : la porte d'entrée « pêche du bord en Bretagne »,
  // avec sa fiche, ses spots en direct et ses moments. Elle remplace le
  // filtre `/spots?region=` qui figurait ici — un filtre n'est pas une page.
  const regionPages: MetadataRoute.Sitemap = REGIONS.map((region) => ({
    url: absoluteUrl(regionPath(region.pays.slug, region.slug)),
    lastModified: now,
    changeFrequency: 'hourly' as const,
    priority: 0.8,
  }));

  const guidePages: MetadataRoute.Sitemap = guides.map((guide) => ({
    url: absoluteUrl(`/guides/${guide.slug}`),
    lastModified: new Date(guide.published),
    changeFrequency: 'yearly',
    priority: 0.6,
  }));

  return [...staticPages, ...paysPages, ...spotPages, ...regionPages, ...guidePages];
}
