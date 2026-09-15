import { describe, expect, it } from 'vitest';
import { SPOTS } from '@/data/spots';
import { MockTideProvider } from '../mock/tide';
import {
  BUDGET_SANS_LIMITE_MAX_SPOTS,
  SelectiveTideProvider,
  parseAllowedSpots,
  tideBudgetWarning,
  unknownAllowedSpots,
} from '../selective-tide';
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

  it('accepte ce qu’une personne tape : guillemets, points-virgules, majuscules, nom de la variable', () => {
    expect(parseAllowedSpots('"pen-hat,la-torche"')).toStrictEqual(['pen-hat', 'la-torche']);
    expect(parseAllowedSpots("'pen-hat'; 'la-torche'")).toStrictEqual(['pen-hat', 'la-torche']);
    expect(parseAllowedSpots('Pen-Hat La-Torche')).toStrictEqual(['pen-hat', 'la-torche']);
    expect(parseAllowedSpots('TIDE_REAL_SPOTS=pen-hat,la-torche')).toStrictEqual(['pen-hat', 'la-torche']);
  });

  it('nomme ce qui ne correspond à aucun spot', () => {
    expect(unknownAllowedSpots('pen-hat,plage-x', ['pen-hat'])).toStrictEqual({
      demandes: ['pen-hat', 'plage-x'],
      inconnus: ['plage-x'],
    });
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

describe('l’avertissement de quota Stormglass', () => {
  const CLE = { STORMGLASS_API_KEY: 'une-cle' };

  it('prévient quand la clé est posée sans TIDE_REAL_SPOTS et que le catalogue est grand', () => {
    const message = tideBudgetWarning(CLE, 42);

    expect(message).not.toBeNull();
    // Le message doit nommer la variable ET donner un exemple utilisable :
    // sans cela il envoie soupçonner la clé, qui n'y est pour rien.
    expect(message).toContain('TIDE_REAL_SPOTS');
    expect(message).toContain('SIMULÉES');
  });

  it('se tait dès que la dépense est bornée', () => {
    expect(tideBudgetWarning({ ...CLE, TIDE_REAL_SPOTS: 'pen-hat' }, 42)).toBeNull();
  });

  it('se tait sans clé : il n’y a alors aucun quota à dépasser', () => {
    expect(tideBudgetWarning({}, 42)).toBeNull();
  });

  it('se tait sur un petit catalogue, qui tient dans le palier gratuit', () => {
    expect(tideBudgetWarning(CLE, BUDGET_SANS_LIMITE_MAX_SPOTS)).toBeNull();
  });

  it('se tait quand le fournisseur est forcé en simulé', () => {
    expect(tideBudgetWarning({ ...CLE, TIDE_PROVIDER: 'mock' }, 42)).toBeNull();
  });

  it('le catalogue réel dépasse le seuil : l’avertissement sert vraiment', () => {
    // Si ce test échoue un jour parce que le catalogue a rétréci, l'avertissement
    // devient du code mort et il faut le retirer plutôt que le garder « au cas où ».
    expect(SPOTS.length).toBeGreaterThan(BUDGET_SANS_LIMITE_MAX_SPOTS);
  });
});
