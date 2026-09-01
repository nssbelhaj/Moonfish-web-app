import { describe, expect, it } from 'vitest';
import { SPOTS } from '@/data/spots';
import { MockTideProvider } from '../mock/tide';
import { SelectiveTideProvider, parseAllowedSpots } from '../selective-tide';
import type { DateRange, SourceMeta, Sourced, TideProvider } from '../types';
import type { Spot, TideEvent } from '@/data/schemas';

const RANGE: DateRange = {
  from: new Date('2026-09-01T00:00:00Z'),
  to: new Date('2026-09-08T00:00:00Z'),
};

class CountingProvider implements TideProvider {
  calls: string[] = [];
  readonly source: SourceMeta = {
    name: 'Fournisseur réel',
    kind: 'forecast',
    precision: 'peu importe',
  };

  async getTideEvents(spot: Spot, range: DateRange): Promise<Sourced<TideEvent[]>> {
    this.calls.push(spot.slug);
    const mock = await new MockTideProvider().getTideEvents(spot, range);
    return { ...mock, source: this.source };
  }
}

describe('parseAllowedSpots', () => {
  it('rend une liste vide quand la variable est absente ou vide', () => {
    expect(parseAllowedSpots(undefined)).toStrictEqual([]);
    expect(parseAllowedSpots('')).toStrictEqual([]);
    expect(parseAllowedSpots('  ,  ,')).toStrictEqual([]);
  });

  it('tolère les espaces autour des slugs', () => {
    expect(parseAllowedSpots(' pen-hat , la-torche ')).toStrictEqual(['pen-hat', 'la-torche']);
  });
});

describe('SelectiveTideProvider', () => {
  const allowed = SPOTS[0]!;
  const denied = SPOTS[1]!;

  it('n’appelle le fournisseur réel que pour les spots autorisés', async () => {
    const real = new CountingProvider();
    const provider = new SelectiveTideProvider(real, new MockTideProvider(), [allowed.slug]);

    await provider.getTideEvents(allowed, RANGE);
    await provider.getTideEvents(denied, RANGE);

    expect(real.calls).toStrictEqual([allowed.slug]);
  });

  it('sert le modèle de démonstration aux spots écartés, sans le marquer en panne', async () => {
    // Un spot hors quota n'est pas une coupure : il ne doit pas allumer le
    // voyant « Interrompu », réservé aux vraies pannes.
    const provider = new SelectiveTideProvider(
      new CountingProvider(),
      new MockTideProvider(),
      [allowed.slug],
    );

    const result = await provider.getTideEvents(denied, RANGE);
    expect(result.source.kind).toBe('simulated');
    expect(result.source.degraded).toBeUndefined();
    expect(result.data.length).toBeGreaterThan(0);
  });

  it('déclare la source RÉELLE comme source configurée', async () => {
    const real = new CountingProvider();
    const provider = new SelectiveTideProvider(real, new MockTideProvider(), []);
    expect(provider.source).toBe(real.source);
  });
});
