import { describe, expect, it } from 'vitest';
import { SPOTS } from '@/data/spots';
import { generateMarineSeries } from '@/data/generators/marine';
import { generateTideEvents, tidalRangeFor, tideCoefficientFor } from '@/data/generators/tide';
import {
  SLOTS_PER_DAY,
  buildForecastDays,
  favourableSlots,
  getSpotForecast,
  referenceNow,
} from '@/lib/forecast';
import { localHours } from '@/lib/time';
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
  it('rend 7 jours de créneaux pour chacun des 12 spots', async () => {
    for (const s of SPOTS) {
      const forecast = await getSpotForecast(s, NOW);
      expect(forecast.days).toHaveLength(7);
      for (const day of forecast.days) {
        expect(day.slots).toHaveLength(SLOTS_PER_DAY);
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
    expect(forecast.sources.tide.source.kind).toBe('simulated');
    expect(forecast.sources.weather.source.kind).toBe('simulated');
    expect(forecast.sources.astro.source.kind).toBe('computed');
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

describe('panne du fournisseur de marées (D11)', () => {
  // La journée locale commence AVANT minuit UTC en Europe/Paris : la série
  // marine part de la veille pour couvrir le premier créneau.
  const from = new Date('2026-08-31T00:00:00Z');
  const to = new Date('2026-09-08T00:00:00Z');

  it('garde les huit créneaux de la journée quand aucune marée n’est couverte', () => {
    // Sauter les créneaux sans marée faisait disparaître la journée entière de
    // l'interface, sans qu'aucun message n'explique le trou.
    const days = buildForecastDays(spot, NOW, [], generateMarineSeries(spot, from, to));
    expect(days[0]!.slots).toHaveLength(SLOTS_PER_DAY);
    expect(days[0]!.slots.every((slot) => slot.tide === null)).toBe(true);
  });

  it('calcule quand même un score, sur les facteurs restants, et le déclare', () => {
    const days = buildForecastDays(spot, NOW, [], generateMarineSeries(spot, from, to));
    const slot = days[0]!.slots[0]!;

    expect(slot.score.value).not.toBeNull();
    expect(slot.score.coverage).toBeCloseTo(1 - 0.32, 10);
    expect(slot.score.reasons.join(' ')).toContain('Calculé sans la marée');
  });

  it('ne se contredit pas : avec les marées, plus rien n’est déclaré manquant', () => {
    const days = buildForecastDays(
      spot,
      NOW,
      generateTideEvents(spot, from, to),
      generateMarineSeries(spot, from, to),
    );
    const slot = days[0]!.slots[0]!;

    expect(slot.tide).not.toBeNull();
    expect(slot.score.coverage).toBeCloseTo(1, 10);
    expect(slot.score.reasons.join(' ')).not.toContain('Calculé sans');
  });
});

describe('panne du fournisseur météo (D11)', () => {
  const from = new Date('2026-08-31T00:00:00Z');
  const to = new Date('2026-09-08T00:00:00Z');

  it('garde les créneaux et déclare le vent et la houle manquants', () => {
    const days = buildForecastDays(spot, NOW, generateTideEvents(spot, from, to), []);
    const slot = days[0]!.slots[0]!;

    expect(days[0]!.slots).toHaveLength(SLOTS_PER_DAY);
    expect(slot.conditions).toBeNull();
    expect(slot.score.value).not.toBeNull();
    // La pression vient de la MÊME série météo : elle disparaît avec elle, et
    // la déclaration doit la nommer aussi. L'oublier laisserait croire que le
    // score tient encore compte d'un facteur qu'il n'a plus.
    expect(slot.score.reasons.join(' ')).toContain(
      'Calculé sans le vent, la houle ni la pression',
    );
  });

  it('ne déclare jamais la sortie sûre sans mesure de vent ni de houle', () => {
    const days = buildForecastDays(spot, NOW, generateTideEvents(spot, from, to), []);
    for (const slot of days[0]!.slots) {
      expect(slot.score.safety.level).not.toBe('ok');
    }
  });
});

describe('éphémérides : la date locale, pas la date UTC', () => {
  const from = new Date('2026-08-31T00:00:00Z');
  const to = new Date('2026-09-08T00:00:00Z');
  const days = () =>
    buildForecastDays(
      spot,
      NOW,
      generateTideEvents(spot, from, to),
      generateMarineSeries(spot, from, to),
    );

  it('place le lever et le coucher DANS la journée locale affichée', () => {
    // À Paris, minuit local du 1er septembre vaut 22 h UTC le 31 août. Calculer
    // les éphémérides sur la date UTC de cet instant donnait celles de la
    // VEILLE : le lever tombait avant le début de la journée affichée.
    const all = days();
    for (let index = 0; index < all.length - 1; index += 1) {
      const day = all[index]!;
      const start = new Date(day.date).getTime();
      const end = new Date(all[index + 1]!.date).getTime();

      expect(day.sunrise).not.toBeNull();
      expect(day.sunset).not.toBeNull();
      expect(new Date(day.sunrise!).getTime()).toBeGreaterThanOrEqual(start);
      expect(new Date(day.sunrise!).getTime()).toBeLessThan(end);
      expect(new Date(day.sunset!).getTime()).toBeGreaterThan(new Date(day.sunrise!).getTime());
      expect(new Date(day.sunset!).getTime()).toBeLessThan(end);
    }
  });

  it('ne classe pas l’après-midi de septembre en « nuit »', () => {
    const day = days()[0]!;
    const afternoon = day.slots.find((slot) => {
      const middle = new Date(new Date(slot.start).getTime() + 1.5 * 3_600_000);
      return Math.round(localHours(middle, spot.timezone)) === 14;
    });

    expect(afternoon).toBeDefined();
    expect(afternoon!.lightPhase).toBe('day');
  });

  it('donne bien les quatre phases sur une journée, pas une seule', () => {
    // Le symptôme du bug : les huit créneaux portaient la même phase.
    const phases = new Set(days()[0]!.slots.map((slot) => slot.lightPhase));
    expect(phases.size).toBeGreaterThan(1);
    expect(phases.has('day')).toBe(true);
    expect(phases.has('night')).toBe(true);
  });
});

describe('éphémérides lunaires dans la prévision', () => {
  const from = new Date('2026-08-31T00:00:00Z');
  const to = new Date('2026-09-10T00:00:00Z');
  const days = buildForecastDays(
    spot,
    NOW,
    generateTideEvents(spot, from, to),
    generateMarineSeries(spot, from, to),
  );

  it('place le lever et le coucher DANS la journée qu’ils annoncent', () => {
    // Le bug qu'on ne veut pas revoir : une éphéméride calculée sur la date UTC
    // alors que la journée affichée est locale. En septembre, deux heures
    // d'écart suffisaient à sortir l'instant de sa propre journée.
    for (const day of days) {
      const start = new Date(day.date).getTime();
      const end = start + 24 * 3_600_000;
      for (const iso of [day.moonrise, day.moonset]) {
        if (iso === null) continue;
        const t = new Date(iso).getTime();
        expect(t).toBeGreaterThanOrEqual(start);
        expect(t).toBeLessThan(end);
      }
    }
  });

  it('espace deux levers successifs d’un jour lunaire', () => {
    // L'invariant est le JOUR LUNAIRE (24 h 50), pas la journée civile. Quand
    // le lever saute une date — il passe de 23 h 21 à 00 h 13 le
    // surlendemain —, l'écart entre les deux instants reste 24 h 52 : c'est en
    // rapportant l'écart au numéro du jour affiché qu'on obtient un absurde
    // « -23 h », et c'est le test qui aurait tort, pas le calcul.
    const rises = days
      .map((day) => day.moonrise)
      .filter((iso): iso is string => iso !== null)
      .map((iso) => new Date(iso).getTime());

    expect(rises.length).toBeGreaterThan(3);

    for (let i = 0; i < rises.length - 1; i += 1) {
      const gapMin = ((rises[i + 1] as number) - (rises[i] as number)) / 60_000;
      expect(gapMin).toBeGreaterThan(24 * 60 + 10);
      expect(gapMin).toBeLessThan(25 * 60 + 30);
    }
  });

  it('accepte une journée sans lever plutôt que d’en inventer un', () => {
    // Sur dix jours, il y a une chance sur trois environ qu'un lever saute une
    // journée civile. Le champ vaut alors `null` et le rendu écrit « pas de
    // lever » — ce que vérifie `MoonTimesInline`.
    for (const day of days) {
      expect(day.moonrise === null || typeof day.moonrise === 'string').toBe(true);
      expect(day.moonset === null || typeof day.moonset === 'string').toBe(true);
    }
  });

  it('donne des instants différents à deux spots éloignés', () => {
    // L'ancien modèle ne connaissait que la longitude : deux spots de même
    // longitude et de latitudes très différentes avaient le même lever, ce qui
    // est faux.
    const other = SPOTS.find((s) => Math.abs(s.lat - spot.lat) > 10);
    expect(other).toBeDefined();

    const otherDays = buildForecastDays(
      other as typeof spot,
      NOW,
      generateTideEvents(other as typeof spot, from, to),
      generateMarineSeries(other as typeof spot, from, to),
    );

    const pairs = days
      .map((day, index) => [day.moonrise, otherDays[index]?.moonrise ?? null] as const)
      .filter((pair): pair is readonly [string, string] => pair[0] !== null && pair[1] !== null);

    expect(pairs.length).toBeGreaterThan(0);
    const gaps = pairs.map(
      ([a, b]) => Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 60_000,
    );
    expect(Math.max(...gaps)).toBeGreaterThan(5);
  });

  it('garde la phase du jour cohérente avec celle des créneaux', () => {
    for (const day of days) {
      expect(day.moonIlluminationPct).toBeGreaterThanOrEqual(0);
      expect(day.moonIlluminationPct).toBeLessThanOrEqual(100);
      expect(day.moonWaxing).toBe(day.moonAgeDays < 14.765294);

      for (const slot of day.slots) {
        const noteHasPhase = slot.score.breakdown.solunar.note.length > 0;
        expect(noteHasPhase).toBe(true);
      }
    }
  });
});
