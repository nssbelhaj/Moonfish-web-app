import { describe, expect, it, vi } from 'vitest';
import { SPOTS } from '@/data/spots';
import { TideProviderWithFallback } from '../fallback';
import { MockTideProvider } from '../mock/tide';
import { StormglassError, StormglassTideProvider } from '../stormglass/tide';

const spot = SPOTS.find((s) => s.slug === 'pen-hat')!;
const H = 3_600_000;
const START = Date.UTC(2026, 8, 1);
const range = { from: new Date(START), to: new Date(START + 9 * 24 * H) };

/** Une série d'extremums plausible : semi-diurne, marnage variable. */
function extremes(startMs: number, count: number, meanRange: number, base = 4) {
  const data = [];
  for (let i = 0; i < count; i += 1) {
    const isHigh = i % 2 === 0;
    const amplitude = meanRange / 2;
    data.push({
      time: new Date(startMs + i * 6.21 * H).toISOString(),
      height: base + (isHigh ? amplitude : -amplitude),
      type: isHigh ? 'high' : 'low',
    });
  }
  return data;
}

/** Aiguille sur la latitude : Brest est à 48.38, Pen Hat à 48.29. */
function stub(options: {
  spotData?: unknown;
  brestData?: unknown;
  status?: number;
  brestRange?: number;
} = {}) {
  const urls: string[] = [];
  const impl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    urls.push(url);
    if (options.status && options.status >= 400) {
      return Response.json({ errors: { key: 'API quota exceeded' } }, { status: options.status });
    }
    const isBrest = url.includes('lat=48.3833');
    const body = isBrest
      ? (options.brestData ?? {
          data: extremes(START, 40, options.brestRange ?? 5.8),
          meta: { requestCount: 3, dailyQuota: 10, datum: 'MLLW' },
        })
      : (options.spotData ?? { data: extremes(START + 0.4 * H, 40, 6.4), meta: {} });
    return Response.json(body, { headers: init?.headers as HeadersInit });
  }) as unknown as typeof fetch;

  return { provider: new StormglassTideProvider('cle-de-test', { fetchImpl: impl }), urls };
}

describe('Stormglass — requêtes', () => {
  it('refuse de se construire sans clé', () => {
    expect(() => new StormglassTideProvider('')).toThrow(StormglassError);
    expect(() => new StormglassTideProvider('   ')).toThrow(StormglassError);
  });

  it('interroge le spot ET Brest', async () => {
    // Brest n'est pas une redondance : le coefficient français y est défini.
    const { provider, urls } = stub();
    await provider.getTideEvents(spot, range);

    expect(urls).toHaveLength(2);
    expect(urls.some((url) => url.includes('lat=48.3833'))).toBe(true);
    expect(urls.some((url) => url.includes(`lat=${spot.lat.toFixed(4)}`))).toBe(true);
  });

  it('demande le zéro MLLW et borne l’intervalle en secondes', async () => {
    const { provider, urls } = stub();
    await provider.getTideEvents(spot, range);
    for (const url of urls) {
      expect(url).toContain('datum=MLLW');
      expect(url).toContain(`start=${Math.floor(range.from.getTime() / 1000)}`);
    }
  });

  it('envoie la clé dans l’en-tête Authorization', async () => {
    const seen: (HeadersInit | undefined)[] = [];
    const impl = (async (input: RequestInfo | URL, init?: RequestInit) => {
      seen.push(init?.headers);
      const isBrest = String(input).includes('lat=48.3833');
      return Response.json({ data: extremes(START, 40, isBrest ? 5.8 : 6.4) });
    }) as unknown as typeof fetch;

    await new StormglassTideProvider('ma-cle', { fetchImpl: impl }).getTideEvents(spot, range);
    for (const headers of seen) {
      expect((headers as Record<string, string>).Authorization).toBe('ma-cle');
    }
  });
});

describe('Stormglass — coefficient', () => {
  /**
   * Le point qui distingue une intégration correcte d'une intégration naïve :
   * le coefficient vient du marnage de BREST, pas de celui du spot. Ici le spot
   * a un marnage de 6,4 m et Brest de 5,8 m — le résultat doit être 95, la
   * vive-eau moyenne, et non 105.
   */
  it('calcule le coefficient sur le marnage de Brest, pas sur celui du spot', async () => {
    const { provider } = stub({ brestRange: 5.8 });
    const result = await provider.getTideEvents(spot, range);

    expect(result.data.length).toBeGreaterThan(10);
    for (const event of result.data) {
      expect(event.coefficient).toBe(95);
    }
  });

  it('suit le marnage de Brest quand il change', async () => {
    const neap = await stub({ brestRange: 2.75 }).provider.getTideEvents(spot, range);
    const spring = await stub({ brestRange: 7.0 }).provider.getTideEvents(spot, range);

    expect(neap.data[0]?.coefficient).toBe(45);
    expect(spring.data[0]?.coefficient).toBe(115);
  });

  it('conserve les hauteurs du spot, pas celles de Brest', async () => {
    const { provider } = stub({ brestRange: 5.8 });
    const result = await provider.getTideEvents(spot, range);
    const high = result.data.find((event) => event.type === 'high');
    // Spot : base 4 + 6,4/2 = 7,2 m.
    expect(high?.heightM).toBeCloseTo(7.2, 2);
  });

  it('étiquette la source comme prévision et renvoie vers le SHOM', async () => {
    const { provider } = stub();
    const result = await provider.getTideEvents(spot, range);
    expect(result.source.kind).toBe('forecast');
    expect(result.source.precision).toContain('SHOM');
  });
});

describe('Stormglass — pannes', () => {
  it('lève sur un quota dépassé', async () => {
    const { provider } = stub({ status: 402 });
    await expect(provider.getTideEvents(spot, range)).rejects.toThrow(/refusé/);
  });

  it('lève sur une couverture insuffisante plutôt que d’afficher des jours vides', async () => {
    const { provider } = stub({ spotData: { data: extremes(START, 6, 6.4) } });
    await expect(provider.getTideEvents(spot, range)).rejects.toThrow(/Couverture insuffisante/);
  });

  it('lève quand Brest ne permet aucun coefficient', async () => {
    const { provider } = stub({
      brestData: { data: [{ time: new Date(START).toISOString(), height: 2, type: 'low' }] },
    });
    await expect(provider.getTideEvents(spot, range)).rejects.toThrow(/coefficient/);
  });

  it('arme un délai maximal', async () => {
    const impl = (async (_url: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
      })) as unknown as typeof fetch;

    const provider = new StormglassTideProvider('k', { fetchImpl: impl, timeoutMs: 50 });
    await expect(provider.getTideEvents(spot, range)).rejects.toThrow(/50 ms/);
  });
});

describe('repli des marées', () => {
  /**
   * Une heure de pleine mer inventée peut mettre quelqu'un en danger sur un
   * estran. Le repli doit donc se dénoncer lui-même, sans exception.
   */
  it('repasse la source en simulée et renvoie vers le SHOM', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const impl = (async () => {
      throw new TypeError('fetch failed');
    }) as unknown as typeof fetch;

    const wrapped = new TideProviderWithFallback(
      new StormglassTideProvider('k', { fetchImpl: impl }),
      new MockTideProvider(),
    );

    const result = await wrapped.getTideEvents(spot, range);

    expect(result.source.kind).toBe('simulated');
    expect(result.source.name).toMatch(/repli/i);
    expect(result.source.precision).toContain('shom');
    expect(result.data.length).toBeGreaterThan(0);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('sert les marées réelles tant que le fournisseur répond', async () => {
    const { provider } = stub();
    const wrapped = new TideProviderWithFallback(provider, new MockTideProvider());
    expect((await wrapped.getTideEvents(spot, range)).source.kind).toBe('forecast');
  });
});
