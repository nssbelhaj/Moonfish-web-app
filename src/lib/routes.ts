import type { Spot } from '@/data/schemas';

/** URL canonique d'un spot. Slugs sans accent, lisibles, stables. */
export function spotPath(spot: Pick<Spot, 'countrySlug' | 'regionSlug' | 'slug'>): string {
  return `/spots/${spot.countrySlug}/${spot.regionSlug}/${spot.slug}`;
}

const FALLBACK_SITE_URL = 'https://moonfish.fish';

/**
 * Normalise l'URL du site.
 *
 * `metadataBase` fait un `new URL()` sur cette valeur, et `new URL()` LÈVE sur
 * une chaîne sans protocole. Une variable d'environnement saisie
 * « mon-site.vercel.app » — la forme la plus naturelle, et celle que Vercel
 * expose lui-même dans `VERCEL_URL` — faisait donc échouer le build entier à
 * l'étape « Collecting page data », avec un message qui ne désigne pas la cause.
 *
 * On préfixe ce qui n'a pas de protocole, on retire la barre finale, et on
 * retombe sur le domaine par défaut plutôt que de casser le build sur une
 * valeur illisible.
 */
export function normalizeSiteUrl(raw: string | undefined | null): string {
  const candidate = (raw ?? '').trim();
  if (candidate.length === 0) return FALLBACK_SITE_URL;

  const withProtocol = /^https?:\/\//i.test(candidate) ? candidate : `https://${candidate}`;

  try {
    const url = new URL(withProtocol);
    if (url.hostname.length === 0) return FALLBACK_SITE_URL;
    const path = url.pathname.replace(/\/+$/, '');
    return `${url.origin}${path}`;
  } catch {
    console.warn(
      `[config] NEXT_PUBLIC_SITE_URL est inexploitable ("${candidate}"). Repli sur ${FALLBACK_SITE_URL}.`,
    );
    return FALLBACK_SITE_URL;
  }
}

/**
 * Base des URL canoniques, du sitemap et des balises Open Graph.
 *
 * Ordre de résolution : la variable explicite d'abord, puis le domaine de
 * production que Vercel injecte tout seul, puis l'URL de déploiement. Un
 * déploiement d'essai a ainsi des canonicals justes sans aucune configuration —
 * c'est précisément le moment où personne ne pense à définir la variable.
 */
export const SITE_URL = normalizeSiteUrl(
  process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.VERCEL_PROJECT_PRODUCTION_URL ??
    process.env.VERCEL_URL,
);

export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}
