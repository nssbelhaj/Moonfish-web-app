import type { MetadataRoute } from 'next';
import { absoluteUrl } from '@/lib/routes';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Le handler de liste d'attente n'a rien à faire dans un index.
        disallow: ['/api/'],
      },
    ],
    sitemap: absoluteUrl('/sitemap.xml'),
  };
}
