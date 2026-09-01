import { describe, expect, it, vi } from 'vitest';
import { SPOTS } from '@/data/spots';
import { MockWeatherProvider } from '../mock/weather';
import { OpenMeteoError, OpenMeteoWeatherProvider } from '../open-meteo/weather';
import { WeatherProviderWithFallback } from '../fallback';
import { forecastResponse, marineResponse, stubFetch, T0 } from './fixtures/open-meteo';

const spot = SPOTS.find((s) => s.slug === 'pen-hat')!;
const range = {
  from: new Date(T0 * 1000),
  to: new Date((T0 + 6 * 3600) * 1000),
};

function providerWith(handlers: Parameters<typeof stubFetch>[0] = {}) {
  const { impl, urls } = stubFetch(handlers);
  return { provider: new OpenMeteoWeatherProvider({ fetchImpl: impl }), urls };
}

describe('Open-Meteo — construction des requêtes', () => {
  it('interroge les deux modèles en un seul passage', async () => {
    const { provider, urls } = providerWith();
    await provider.getMarineSeries(spot, range);

    expect(urls).toHaveLength(2);
    expect(urls.some((url) => url.includes('marine-api.open-meteo.com'))).toBe(true);
    expect(urls.some((url) => url.includes('api.open-meteo.com/v1/forecast'))).toBe(true);
  });

  it('demande la maille MARINE, pas la plus proche', async () => {
    // Sur un spot de bord, la maille terrestre donnerait un vent freiné par le
    // relief, sans rapport avec ce qu'on subit sur l'estran.
    const { provider, urls } = providerWith();
    await provider.getMarineSeries(spot, range);
    for (const url of urls) expect(url).toContain('cell_selection=sea');
  });

  it('verrouille les unités et le format de temps', async () => {
    const { provider, urls } = providerWith();
    await provider.getMarineSeries(spot, range);

    const forecastUrl = urls.find((url) => url.includes('/v1/forecast')) ?? '';
    // Le score raisonne en km/h : laisser l'unité par défaut serait un pari.
    expect(forecastUrl).toContain('wind_speed_unit=kmh');
    for (const url of urls) {
      expect(url).toContain('timeformat=unixtime');
      expect(url).toContain('past_days=1');
    }
  });

  it('transmet les coordonnées réelles du spot', async () => {
    const { provider, urls } = providerWith();
    await provider.getMarineSeries(spot, range);
    for (const url of urls) {
      expect(url).toContain(`latitude=${spot.lat.toFixed(4)}`);
      expect(url).toContain(`longitude=${spot.lng.toFixed(4)}`);
    }
  });
});

describe('Open-Meteo — recomposition des tableaux parallèles', () => {
  it('reconstitue des MarinePoint complets et correctement typés', async () => {
    const { provider } = providerWith();
    const result = await provider.getMarineSeries(spot, range);

    expect(result.data).toHaveLength(6);
    expect(result.data[0]).toStrictEqual({
      time: new Date(T0 * 1000).toISOString(),
      windSpeedKmh: 14.8,
      windFromDeg: 268,
      swellHeightM: 1.24,
      swellPeriodS: 8.5,
      swellFromDeg: 281,
      windGustKmh: 22.7,
      airTempC: 16.1,
      waterTempC: 17.4,
      cloudCoverPct: 75,
      pressureHpa: 1014,
      // Champs de confort : le stub ne les fournit pas, ils doivent donc être
      // NULS et non absents. Un champ manquant ferait échouer le schéma et
      // perdrait l'heure entière ; un `null` dit « pas de donnée » et laisse
      // l'interface écrire « Indispo. ».
      precipitationProbabilityPct: null,
      uvIndex: null,
      visibilityKm: null,
      apparentTempC: null,
      humidityPct: null,
      dewPointC: null,
    });
  });

  it('étiquette la source comme prévision, pas comme relevé ni comme simulation', async () => {
    const { provider } = providerWith();
    const result = await provider.getMarineSeries(spot, range);

    expect(result.source.kind).toBe('forecast');
    expect(result.source.name).toContain('Open-Meteo');
    expect(result.source.precision).toMatch(/48 h|indicative/i);
  });

  /**
   * Le point qui casse quand on fusionne à l'indice plutôt qu'à l'horodatage.
   * Rien ne garantit que les deux modèles commencent à la même heure.
   */
  it('fusionne sur l’horodatage, pas sur l’indice, quand les séries sont décalées', async () => {
    const { provider } = providerWith({
      marine: () => Response.json(marineResponse({ startEpoch: T0 - 3600, hours: 6 })),
      forecast: () => Response.json(forecastResponse({ startEpoch: T0, hours: 6 })),
    });

    const result = await provider.getMarineSeries(spot, {
      from: new Date((T0 - 3600) * 1000),
      to: new Date((T0 + 6 * 3600) * 1000),
    });

    // Cinq heures se recouvrent ; l'heure orpheline de chaque côté est écartée.
    expect(result.data).toHaveLength(5);
    expect(result.data[0]?.time).toBe(new Date(T0 * 1000).toISOString());
    // À T0, la houle est la 2e valeur marine et le vent la 1re valeur forecast.
    expect(result.data[0]?.swellHeightM).toBe(1.31);
    expect(result.data[0]?.windSpeedKmh).toBe(14.8);
  });

  it('écarte l’heure entière quand une grandeur du score manque', async () => {
    const { provider } = providerWith({
      marine: () => Response.json(marineResponse({ wave_height: [1.2, null, 1.4, 1.5, 1.4, 1.3] })),
      forecast: () => Response.json(forecastResponse({ wind_speed_10m: [14, 16, null, 21, 19, 17] })),
    });

    const result = await provider.getMarineSeries(spot, range);
    expect(result.data).toHaveLength(4);
    expect(result.data.map((p) => p.time)).not.toContain(new Date((T0 + 3600) * 1000).toISOString());
  });

  it('rend null — jamais 0 — sur un champ d’affichage manquant', async () => {
    const { provider } = providerWith({
      marine: () => Response.json(marineResponse({ sea_surface_temperature: [null, null, null, null, null, null] })),
      forecast: () => Response.json(forecastResponse({ wind_gusts_10m: [null, null, null, null, null, null] })),
    });

    const result = await provider.getMarineSeries(spot, range);
    expect(result.data[0]?.waterTempC).toBeNull();
    expect(result.data[0]?.windGustKmh).toBeNull();
    // Les grandeurs du score, elles, sont bien là.
    expect(result.data[0]?.swellHeightM).toBe(1.24);
  });

  it('tolère l’absence complète des séries optionnelles', async () => {
    const { provider } = providerWith({
      marine: () => {
        const body = marineResponse();
        delete (body.hourly as Record<string, unknown>).sea_surface_temperature;
        return Response.json(body);
      },
      forecast: () => {
        const body = forecastResponse();
        for (const key of ['wind_gusts_10m', 'temperature_2m', 'cloud_cover', 'pressure_msl']) {
          delete (body.hourly as Record<string, unknown>)[key];
        }
        return Response.json(body);
      },
    });

    const result = await provider.getMarineSeries(spot, range);
    expect(result.data).toHaveLength(6);
    expect(result.data[0]?.airTempC).toBeNull();
    expect(result.data[0]?.pressureHpa).toBeNull();
  });

  it('ne renvoie que les heures de l’intervalle demandé', async () => {
    const { provider } = providerWith();
    const narrow = await provider.getMarineSeries(spot, {
      from: new Date((T0 + 2 * 3600) * 1000),
      to: new Date((T0 + 4 * 3600) * 1000),
    });

    expect(narrow.data).toHaveLength(2);
    expect(narrow.data[0]?.time).toBe(new Date((T0 + 2 * 3600) * 1000).toISOString());
  });

  it('normalise une direction de 360° en 0°', async () => {
    const { provider } = providerWith({
      forecast: () => Response.json(forecastResponse({ wind_direction_10m: [360, 0, 90, 180, 270, 359] })),
    });
    const result = await provider.getMarineSeries(spot, range);
    expect(result.data[0]?.windFromDeg).toBe(0);
    expect(result.data[5]?.windFromDeg).toBe(359);
  });
});

describe('Open-Meteo — pannes', () => {
  it('lève une erreur typée sur une réponse HTTP en échec', async () => {
    const { provider } = providerWith({
      marine: () => Response.json({ error: true, reason: 'Parameter forecast_days is invalid.' }, { status: 400 }),
    });

    await expect(provider.getMarineSeries(spot, range)).rejects.toThrow(OpenMeteoError);
    await expect(provider.getMarineSeries(spot, range)).rejects.toThrow(/forecast_days/);
  });

  it('lève une erreur typée quand le réseau est coupé', async () => {
    const impl = (async () => {
      throw new TypeError('fetch failed');
    }) as unknown as typeof fetch;

    const provider = new OpenMeteoWeatherProvider({ fetchImpl: impl });
    await expect(provider.getMarineSeries(spot, range)).rejects.toThrow(OpenMeteoError);
  });

  it('refuse une réponse dont la forme ne correspond pas au schéma', async () => {
    const { provider } = providerWith({
      marine: () => Response.json({ hourly: { time: [1, 2], wave_height: 'pas un tableau' } }),
    });

    await expect(provider.getMarineSeries(spot, range)).rejects.toThrow();
  });

  it('lève plutôt que de rendre une série vide', async () => {
    const { provider } = providerWith({
      marine: () => Response.json(marineResponse({ startEpoch: T0 + 100 * 3600 })),
    });

    await expect(provider.getMarineSeries(spot, range)).rejects.toThrow(/exploitable/);
  });
});

describe('repli météo', () => {
  it('sert les données réelles tant que le fournisseur répond', async () => {
    const { impl } = stubFetch();
    const wrapped = new WeatherProviderWithFallback(
      new OpenMeteoWeatherProvider({ fetchImpl: impl }),
      new MockWeatherProvider(),
    );

    const result = await wrapped.getMarineSeries(spot, range);
    expect(result.source.kind).toBe('forecast');
  });

  /**
   * Le comportement qui compte : un mode dégradé ne doit jamais se faire passer
   * pour un mode normal. Le repli repasse la source en `simulated`, ce qui
   * rallume l'avertissement de démonstration sur les pages.
   */
  it('repasse explicitement la source en simulée quand le fournisseur tombe', async () => {
    const impl = (async () => {
      throw new TypeError('fetch failed');
    }) as unknown as typeof fetch;

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const wrapped = new WeatherProviderWithFallback(
      new OpenMeteoWeatherProvider({ fetchImpl: impl }),
      new MockWeatherProvider(),
    );

    const result = await wrapped.getMarineSeries(spot, range);

    expect(result.source.kind).toBe('simulated');
    expect(result.source.name).toMatch(/repli/i);
    expect(result.data.length).toBeGreaterThan(0);
    expect(errorSpy).toHaveBeenCalled();

    errorSpy.mockRestore();
  });
});

describe('Open-Meteo — valeurs aberrantes', () => {
  /**
   * Trouvé en exerçant le pipeline complet contre un serveur local : une seule
   * rafale négative faisait échouer la validation et basculait TOUT le spot sur
   * les données simulées. Perdre sept jours de vraie prévision pour une case
   * d'affichage est disproportionné.
   */
  it('réduit un champ d’affichage hors bornes à null sans perdre la série', async () => {
    const { provider } = providerWith({
      forecast: () =>
        Response.json(forecastResponse({ wind_gusts_10m: [-3, 25.2, 28.8, 99999, 30.2, 26.6] })),
    });

    const result = await provider.getMarineSeries(spot, range);

    expect(result.data).toHaveLength(6);
    expect(result.data[0]?.windGustKmh).toBeNull();
    expect(result.data[3]?.windGustKmh).toBeNull();
    expect(result.data[1]?.windGustKmh).toBe(25.2);
    // Les grandeurs du score sont intactes sur toutes les heures.
    expect(result.data.every((point) => point.windSpeedKmh > 0)).toBe(true);
  });

  it('écarte l’heure quand une grandeur du score est hors bornes', async () => {
    const { provider } = providerWith({
      marine: () => Response.json(marineResponse({ wave_height: [1.2, -0.5, 1.4, 1.5, 1.4, 1.3] })),
    });

    const result = await provider.getMarineSeries(spot, range);
    expect(result.data).toHaveLength(5);
  });

  it('rejette une pression physiquement impossible sans casser l’heure', async () => {
    const { provider } = providerWith({
      forecast: () => Response.json(forecastResponse({ pressure_msl: [1014, 1013, 12, 1012, 1012, 1013] })),
    });

    const result = await provider.getMarineSeries(spot, range);
    expect(result.data).toHaveLength(6);
    expect(result.data[2]?.pressureHpa).toBeNull();
  });
});

describe('Open-Meteo — délai maximal', () => {
  /**
   * Régression : `fetch` sans signal attend indéfiniment. Au build, un
   * fournisseur qui ne répond pas sans refuser la connexion bloquait la
   * génération jusqu'à ce que la plateforme tue le processus — un échec de
   * build dont aucun message ne désignait la cause.
   */
  it('arme un signal d’expiration sur chaque appel', async () => {
    const signals: (AbortSignal | undefined)[] = [];
    const impl = (async (_url: RequestInfo | URL, init?: RequestInit) => {
      signals.push(init?.signal ?? undefined);
      return Response.json(marineResponse());
    }) as unknown as typeof fetch;

    const provider = new OpenMeteoWeatherProvider({ fetchImpl: impl, timeoutMs: 1234 });
    await provider.getMarineSeries(spot, range).catch(() => undefined);

    expect(signals.length).toBeGreaterThan(0);
    for (const signal of signals) expect(signal).toBeInstanceOf(AbortSignal);
  });

  it('transforme une absence de réponse en erreur explicite, pas en attente infinie', async () => {
    const impl = (async (_url: RequestInfo | URL, init?: RequestInit) => {
      // Ne résout jamais de lui-même : seul le signal peut l'interrompre.
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(init.signal?.reason ?? new Error('aborted'));
        });
      });
    }) as unknown as typeof fetch;

    const provider = new OpenMeteoWeatherProvider({ fetchImpl: impl, timeoutMs: 60 });

    await expect(provider.getMarineSeries(spot, range)).rejects.toThrow(OpenMeteoError);
    await expect(provider.getMarineSeries(spot, range)).rejects.toThrow(/60 ms/);
  });
});
