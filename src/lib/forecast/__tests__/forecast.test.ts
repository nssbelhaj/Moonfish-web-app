import { describe, expect, it } from 'vitest';
import { SPOTS } from '@/data/spots';
import { generateMarineSeries } from '@/data/generators/marine';
import { generateTideEvents, tidalRangeFor, tideCoefficientFor } from '@/data/generators/tide';
import { favourableSlots, getSpotForecast, referenceNow } from '@/lib/forecast';
import { tideContextAt } from '../tide-context';

const NOW = new Date('2026-09-01T09:00:00Z');
const spot = SPOTS[0]!;

describe('déterminisme', () => {
  it('produit exactement la même série marine à deux appels', () => {
    const from = new Date('2026-09-01T00:00:00Z');
    const to = new Date('2026-09-03T00:00:00Z');
    expect(generateMarineSeries(spot, from, to)).toStrictEqual(generateMarineSeries(spot, from, to));
  });

  it('produit exactement les mêmes marées à deux appels', () => {
    const from = new Date('2026-09-01T00:00:00Z');
    const to = new Date('2026-09-08T00:00:00Z');
    expect(generateTideEvents(spot, from, to)).toStrictEqual(generateTideEvents(spot, from, to));
  });

  it('donne des séries différentes à deux spots différents', () => {
    const from = new Date('2026-09-01T00:00:00Z');
    const to = new Date('2026-09-02T00:00:00Z');
    const a = generateMarineSeries(SPOTS[0]!, from, to);
    const b = generateMarineSeries(SPOTS[1]!, from, to);
    expect(a).not.toStrictEqual(b);
  });

  it('arrondit l’instant de référence à l’heure, pour que deux builds proches soient identiques', () => {
    expect(referenceNow().getTime() % 3_600_000).toBe(0);
  });
});

describe('coefficient de marée', () => {
  it('est national : il ne dépend que de l’instant, jamais du spot', () => {
    // Le coefficient français est rapporté à Brest. Deux spots n'en ont pas
    // deux valeurs différentes ; seules les HEURES de pleine mer diffèrent.
    const from = new Date('2026-09-01T00:00:00Z');
    const to = new Date('2026-09-04T00:00:00Z');

    for (const s of SPOTS) {
      for (const event of generateTideEvents(s, from, to)) {
        expect(event.coefficient).toBe(tideCoefficientFor(new Date(event.time)));
      }
    }
  });

  it('donne des heures de pleine mer distinctes d’un spot à l’autre', () => {
    const from = new Date('2026-09-01T00:00:00Z');
    const to = new Date('2026-09-02T00:00:00Z');
    const firstHighs = SPOTS.map(
      (s) => generateTideEvents(s, from, to).find((event) => event.type === 'high')?.time,
    );
    expect(new Set(firstHighs).size).toBeGreaterThan(6);
  });

  it('reste dans l’échelle française 20–120', () => {
    for (let d = 0; d < 60; d += 1) {
      const coefficient = tideCoefficientFor(new Date(Date.UTC(2026, 0, 1) + d * 86_400_000));
      expect(coefficient).toBeGreaterThanOrEqual(20);
      expect(coefficient).toBeLessThanOrEqual(120);
    }
  });

  it('parcourt bien vives-eaux et mortes-eaux sur une lunaison', () => {
    const values: number[] = [];
    for (let d = 0; d < 30; d += 1) {
      values.push(tideCoefficientFor(new Date(Date.UTC(2026, 0, 1) + d * 86_400_000)));
    }
    expect(Math.max(...values)).toBeGreaterThan(100);
    expect(Math.min(...values)).toBeLessThan(45);
  });
});

describe('contexte de marée reconstruit depuis les extremums', () => {
  it('renvoie null sans événement, plutôt qu’une valeur inventée', () => {
    expect(tideContextAt(NOW, [])).toBeNull();
  });

  it('place l’instant d’une pleine mer à 0 h et la détecte comme étale', () => {
    const events = generateTideEvents(spot, new Date('2026-09-01T00:00:00Z'), new Date('2026-09-03T00:00:00Z'));
    const high = events.find((event) => event.type === 'high')!;
    const context = tideContextAt(new Date(high.time), events)!;

    expect(Math.abs(context.hoursFromHighTide)).toBeLessThan(0.01);
    expect(context.state).toBe('slack');
    expect(context.coefficient).toBe(high.coefficient);
  });

  it('classe en montante trois heures avant la pleine mer', () => {
    const events = generateTideEvents(spot, new Date('2026-09-01T00:00:00Z'), new Date('2026-09-03T00:00:00Z'));
    const high = events.find((event) => event.type === 'high')!;
    const instant = new Date(new Date(high.time).getTime() - 3 * 3_600_000);
    const context = tideContextAt(instant, events)!;

    expect(context.state).toBe('rising');
    expect(context.hoursFromHighTide).toBeCloseTo(-3, 1);
  });
});

describe('prévision assemblée', () => {
  it('rend 7 jours de 8 créneaux pour chacun des 12 spots', async () => {
    for (const s of SPOTS) {
      const forecast = await getSpotForecast(s, NOW);
      expect(forecast.days).toHaveLength(7);
      for (const day of forecast.days) {
        expect(day.slots).toHaveLength(8);
      }
    }
  });

  it('ne propose jamais un créneau dangereux comme meilleur créneau', async () => {
    for (const s of SPOTS) {
      const forecast = await getSpotForecast(s, NOW);
      expect(forecast.best?.score.safety.level).not.toBe('danger');
      expect(forecast.nextGood?.score.safety.level).not.toBe('danger');
    }
  });

  it('étiquette marée et houle comme simulées, et l’astronomie comme calculée', async () => {
    const forecast = await getSpotForecast(spot, NOW);
    expect(forecast.sources.tide.kind).toBe('simulated');
    expect(forecast.sources.weather.kind).toBe('simulated');
    expect(forecast.sources.astro.kind).toBe('computed');
  });

  it('découpe les journées sur minuit LOCAL, y compris au Maroc', async () => {
    const taghazout = SPOTS.find((s) => s.slug === 'taghazout')!;
    const forecast = await getSpotForecast(taghazout, NOW);

    for (const day of forecast.days) {
      const localHour = new Intl.DateTimeFormat('en-GB', {
        timeZone: taghazout.timezone,
        hour: '2-digit',
        hour12: false,
      }).format(new Date(day.date));
      expect(Number(localHour) % 24).toBe(0);
    }
  });

  it('rend une prévision identique à deux appels avec le même instant', async () => {
    const a = await getSpotForecast(spot, NOW);
    const b = await getSpotForecast(spot, NOW);
    expect(a).toStrictEqual(b);
  });
});

describe('hauteurs d’eau simulées', () => {
  /**
   * Les cotes françaises sont référencées au zéro hydrographique : une hauteur
   * négative n'existe pratiquement jamais. L'échelonnement linéaire initial du
   * marnage produisait des basses mers à −1,12 m sur les gros coefficients.
   */
  it('ne descend jamais sous le zéro des cartes, quel que soit le coefficient', () => {
    for (const s of SPOTS) {
      const events = generateTideEvents(s, new Date('2026-01-01T00:00:00Z'), new Date('2026-03-01T00:00:00Z'));
      for (const event of events) {
        expect(event.heightM).toBeGreaterThan(0);
      }
    }
  });

  it('garde la pleine mer dans un ordre de grandeur crédible pour le marnage du spot', () => {
    for (const s of SPOTS) {
      const events = generateTideEvents(s, new Date('2026-01-01T00:00:00Z'), new Date('2026-03-01T00:00:00Z'));
      const highest = Math.max(...events.map((event) => event.heightM));
      // Jamais plus de 1,6 fois le marnage moyen au-dessus du zéro.
      expect(highest).toBeLessThan(s.meanTideRangeM * 1.6 + 1.5);
    }
  });

  it('creuse le marnage avec le coefficient, sans le rendre proportionnel', () => {
    const spring = tidalRangeFor(spot, 115);
    const neap = tidalRangeFor(spot, 40);
    expect(spring).toBeGreaterThan(neap);
    // Proportionnel donnerait un rapport de 2,9 ; la réalité est bien plus plate.
    expect(spring / neap).toBeLessThan(2);
    expect(tidalRangeFor(spot, 70)).toBeCloseTo(spot.meanTideRangeM, 6);
  });
});

describe('créneaux favorables', () => {
  const slot = (value: number, level: 'ok' | 'prudence' | 'danger') =>
    ({
      start: '2026-09-01T00:00:00.000Z',
      end: '2026-09-01T03:00:00.000Z',
      score: { value, label: 'Bon', reasons: [], breakdown: {}, safety: { level } },
    }) as unknown as Parameters<typeof favourableSlots>[0][number];

  it('retient les créneaux au moins « Bon »', () => {
    const slots = [slot(5.9, 'ok'), slot(6, 'ok'), slot(9.1, 'ok')];
    expect(favourableSlots(slots)).toHaveLength(2);
  });

  /**
   * La règle qui compte : un créneau dangereux n'est jamais « favorable », quel
   * que soit son score. Le signaler comme tel serait le pire usage du produit.
   */
  it('exclut un créneau dangereux même avec un score maximal', () => {
    expect(favourableSlots([slot(10, 'danger')])).toHaveLength(0);
  });

  it('garde un créneau en simple vigilance', () => {
    expect(favourableSlots([slot(7.5, 'prudence')])).toHaveLength(1);
  });

  it('accepte un seuil explicite', () => {
    const slots = [slot(6.5, 'ok'), slot(8.2, 'ok')];
    expect(favourableSlots(slots, 8)).toHaveLength(1);
  });
});

describe('mémoïsation par requête', () => {
  /**
   * Régression : `cache` de React compare ses arguments par RÉFÉRENCE. Clefer
   * sur `(spot, now)` ne mémoïsait rien, puisque `referenceNow()` rend un nouvel
   * objet Date à chaque appel — un cache silencieusement inopérant.
   */
  it('rend le même résultat pour deux instants égaux mais distincts', async () => {
    const a = await getSpotForecast(spot, new Date('2026-09-01T09:00:00Z'));
    const b = await getSpotForecast(spot, new Date('2026-09-01T09:00:00Z'));
    expect(a).toStrictEqual(b);
  });

  it('distingue bien deux instants différents', async () => {
    const a = await getSpotForecast(spot, new Date('2026-09-01T09:00:00Z'));
    const b = await getSpotForecast(spot, new Date('2026-09-02T09:00:00Z'));
    expect(a.generatedAt).not.toBe(b.generatedAt);
  });
});
