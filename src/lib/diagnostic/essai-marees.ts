import type { Point } from './etat';

/**
 * Essai RÉEL d'appel à Stormglass.
 *
 * ── Pourquoi lire la configuration ne suffit pas ─────────────────────────
 *
 * « STORMGLASS_API_KEY est posée » ne dit rien de ce que le fournisseur en
 * pense. Entre la clé posée et une marée réelle à l'écran, il y a : une clé
 * régénérée depuis (401), un quota du jour déjà consommé (402 ou 429), un
 * réseau sortant bloqué par l'hébergeur, et le cache des pages qui garde une
 * heure la version simulée. Chacun de ces cas s'est présenté, et aucun ne se
 * voit dans la forme de la clé. Tous se voient en appelant.
 *
 * ── Le prix d'un essai ───────────────────────────────────────────────────
 *
 * Un appel coûte une requête sur dix par jour. Ouvrir le diagnostic cinq fois
 * viderait la moitié du quota — et ferait tomber en simulé les pages qu'on
 * essaie précisément de vérifier. Le résultat est donc gardé six heures en
 * mémoire, et la page le dit.
 */

const EXTREMES_URL = 'https://api.stormglass.io/v2/tide/extremes/point';
const BREST = { lat: 48.3833, lng: -4.4953 };
const CACHE_MS = 6 * 60 * 60 * 1000;

interface Souvenir {
  point: Point;
  at: number;
}

let souvenir: Souvenir | null = null;

/** Pour les tests : oublie le dernier essai. */
export function oublierEssaiMarees(): void {
  souvenir = null;
}

interface Options {
  fetchImpl?: typeof fetch;
  baseUrl?: string;
  now?: () => number;
}

export async function essaiMarees(
  env: Readonly<Record<string, string | undefined>>,
  options: Options = {},
): Promise<Point | null> {
  const cle = env['STORMGLASS_API_KEY']?.trim();
  // Sans clé ou en mode forcé, `etat.ts` a déjà tout dit : rien à essayer.
  if (!cle || env['TIDE_PROVIDER'] === 'mock') return null;

  const now = options.now ?? Date.now;
  if (souvenir !== null && now() - souvenir.at < CACHE_MS) return souvenir.point;

  const point = await appeler(cle, options);
  souvenir = { point, at: now() };
  return point;
}

async function appeler(cle: string, options: Options): Promise<Point> {
  const sujet = 'Essai Stormglass';
  const fetchImpl = options.fetchImpl ?? fetch;

  const url = new URL(options.baseUrl ?? EXTREMES_URL);
  url.searchParams.set('lat', BREST.lat.toFixed(4));
  url.searchParams.set('lng', BREST.lng.toFixed(4));
  const debut = Math.floor(Date.now() / 1000);
  url.searchParams.set('start', String(debut));
  url.searchParams.set('end', String(debut + 24 * 3600));

  let reponse: Response;
  try {
    reponse = await fetchImpl(url.toString(), {
      headers: { Authorization: cle, accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
    });
  } catch (error) {
    const delai = error instanceof Error && error.name === 'TimeoutError';
    return {
      sujet,
      etat: 'attention',
      constat: delai
        ? 'Stormglass n’a pas répondu en huit secondes depuis ce serveur.'
        : 'Stormglass est injoignable depuis ce serveur : la requête sortante n’aboutit pas.',
      remede:
        'Vérifiez que l’hébergeur autorise les connexions sortantes vers api.stormglass.io. Sans cela, aucune marée réelle ne peut arriver, quelle que soit la clé.',
    };
  }

  const corps = (await reponse.json().catch(() => null)) as {
    meta?: { requestCount?: number; dailyQuota?: number };
    errors?: unknown;
  } | null;

  const quota =
    corps?.meta?.requestCount !== undefined && corps.meta.dailyQuota !== undefined
      ? `${corps.meta.requestCount}/${corps.meta.dailyQuota}`
      : null;

  if (reponse.status === 401 || reponse.status === 403) {
    return {
      sujet,
      etat: 'absent',
      constat: `Stormglass REFUSE la clé (code ${reponse.status}). Elle a été régénérée depuis, ou mal recopiée — une clé qui a circulé dans une conversation a d’ailleurs dû l’être.`,
      remede:
        'Ouvrez stormglass.io, copiez la clé courante, collez-la dans STORMGLASS_API_KEY chez l’hébergeur, puis reconstruisez.',
    };
  }

  if (reponse.status === 402 || reponse.status === 429) {
    return {
      sujet,
      etat: 'attention',
      constat: `La clé est valide mais le QUOTA du jour est épuisé (code ${reponse.status}${quota ? `, ${quota} appels` : ''}). Jusqu’à demain, le repli rend des marées simulées — et les pages gardent cette version une heure après le retour du quota.`,
      remede:
        'Réduisez TIDE_REAL_SPOTS à trois spots, et ne reconstruisez pas plusieurs fois par jour : chaque construction consomme un appel par spot réel, plus un.',
    };
  }

  if (!reponse.ok) {
    return {
      sujet,
      etat: 'attention',
      constat: `Stormglass a répondu ${reponse.status}. Ce n’est ni la clé ni le quota : le service lui-même ou le format de la requête.`,
      remede: 'Réessayez dans une heure. Si cela persiste, consultez status.stormglass.io.',
    };
  }

  return {
    sujet,
    etat: 'ok',
    constat: `Stormglass répond avec la clé posée${quota ? ` — ${quota} appels consommés aujourd’hui, cet essai compris` : ''}. Si une page affiche encore des marées simulées, c’est son cache : elle se régénère au plus tard une heure après la prochaine visite.`,
    remede: null,
  };
}
