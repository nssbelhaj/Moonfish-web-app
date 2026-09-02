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

/**
 * Le repli a-t-il été utilisé faute de configuration ?
 *
 * ─── Pourquoi cet avertissement a dû exister ──────────────────────────────
 *
 * C'est la panne la plus coûteuse de la liste, et la seule qui ne se voie pas
 * en visitant le site : sans `NEXT_PUBLIC_SITE_URL`, tout fonctionne, tout
 * s'affiche, et le sitemap, les URL canoniques et les aperçus de partage
 * désignent `moonfish.fish` — un domaine qui n'est pas le vôtre. Les moteurs
 * indexent l'autre adresse, les liens partagés pointent ailleurs, et rien
 * dans l'interface ne le laisse deviner.
 *
 * Constaté en conditions réelles sur le premier déploiement : site en HTTP
 * 200, sitemap entièrement faux.
 *
 * ─── Le piège dans le piège ───────────────────────────────────────────────
 *
 * Les variables `NEXT_PUBLIC_*` sont INSÉRÉES DANS LE CODE À LA COMPILATION.
 * Les définir dans le panneau puis redémarrer ne change rien : il faut
 * RECONSTRUIRE. C'est la partie que personne ne devine, et le message le dit.
 */
export function siteUrlWarning(): string | null {
  if (process.env.NODE_ENV !== 'production') return null;
  if (SITE_URL !== FALLBACK_SITE_URL) return null;

  /*
    Un domaine de repli délibérément choisi comme valeur reste légitime : on
    ne signale que l'absence de configuration, pas le fait de viser ce
    domaine-là.
  */
  const configured = (process.env.NEXT_PUBLIC_SITE_URL ?? '').trim();
  if (normalizeSiteUrl(configured) === FALLBACK_SITE_URL && configured.length > 0) return null;

  return (
    `NEXT_PUBLIC_SITE_URL n’est pas définie : le sitemap, les URL canoniques et ` +
    `les aperçus de partage annoncent ${FALLBACK_SITE_URL}, qui n’est probablement ` +
    'pas votre domaine. Le site fonctionne, mais il se désigne sous une autre adresse. ' +
    'Cette variable est insérée À LA COMPILATION : la définir ne suffit pas, il faut RECONSTRUIRE.'
  );
}

export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}
