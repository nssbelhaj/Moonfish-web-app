import { beforeEach, describe, expect, it } from 'vitest';

import { essaiMarees, oublierEssaiMarees } from '../essai-marees';

function reponse(status: number, corps: unknown): typeof fetch {
  return (async () =>
    new Response(JSON.stringify(corps), {
      status,
      headers: { 'content-type': 'application/json' },
    })) as unknown as typeof fetch;
}

const ENV = { STORMGLASS_API_KEY: 'une-cle-de-test' };

describe('l’essai Stormglass', () => {
  beforeEach(() => oublierEssaiMarees());

  it('ne fait rien sans clé, ni en mode forcé', async () => {
    expect(await essaiMarees({})).toBeNull();
    expect(await essaiMarees({ ...ENV, TIDE_PROVIDER: 'mock' })).toBeNull();
  });

  it('distingue une clé refusée d’un quota épuisé', async () => {
    const refus = await essaiMarees(ENV, { fetchImpl: reponse(401, { errors: { key: 'invalid' } }) });
    expect(refus?.etat).toBe('absent');
    expect(refus?.constat).toContain('REFUSE');
    expect(refus?.remede).toContain('STORMGLASS_API_KEY');

    oublierEssaiMarees();
    const quota = await essaiMarees(ENV, {
      fetchImpl: reponse(429, { meta: { requestCount: 10, dailyQuota: 10 } }),
    });
    expect(quota?.etat).toBe('attention');
    expect(quota?.constat).toContain('QUOTA');
    expect(quota?.constat).toContain('10/10');
  });

  it('dit combien d’appels il reste quand tout va bien', async () => {
    const ok = await essaiMarees(ENV, {
      fetchImpl: reponse(200, { data: [], meta: { requestCount: 3, dailyQuota: 10 } }),
    });
    expect(ok?.etat).toBe('ok');
    expect(ok?.constat).toContain('3/10');
    // Et prévient que le cache des pages peut encore montrer l'ancien état.
    expect(ok?.constat).toContain('cache');
  });

  it('nomme le réseau quand rien ne répond', async () => {
    const panne = await essaiMarees(ENV, {
      fetchImpl: (async () => {
        throw new TypeError('fetch failed');
      }) as unknown as typeof fetch,
    });
    expect(panne?.etat).toBe('attention');
    expect(panne?.constat).toContain('injoignable');
  });

  it('ne dépense qu’UN appel par six heures, quel que soit le nombre de visites', async () => {
    /*
      Le quota gratuit est de dix par jour. Un diagnostic qu'on rafraîchit
      cinq fois de suite en dépenserait la moitié — et ferait tomber en simulé
      les pages qu'il est censé vérifier.
    */
    let appels = 0;
    const compteur: typeof fetch = (async () => {
      appels += 1;
      return new Response(JSON.stringify({ data: [], meta: { requestCount: 1, dailyQuota: 10 } }), { status: 200 });
    }) as unknown as typeof fetch;

    let horloge = 1_000_000;
    const now = () => horloge;

    await essaiMarees(ENV, { fetchImpl: compteur, now });
    await essaiMarees(ENV, { fetchImpl: compteur, now });
    await essaiMarees(ENV, { fetchImpl: compteur, now });
    expect(appels).toBe(1);

    horloge += 7 * 60 * 60 * 1000;
    await essaiMarees(ENV, { fetchImpl: compteur, now });
    expect(appels).toBe(2);
  });

  it('n’écrit jamais la clé dans ce qu’il rend', async () => {
    const point = await essaiMarees(ENV, { fetchImpl: reponse(401, {}) });
    expect(JSON.stringify(point)).not.toContain('une-cle-de-test');
  });
});
