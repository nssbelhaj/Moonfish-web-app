import { describe, expect, it } from 'vitest';

import { SPOTS } from '@/data/spots';
import { BREST_REFERENCE, type TideExtreme } from '@/lib/forecast/tide-coefficient';
import type { DateRange, SourceMeta } from '../../types';
import {
  BUDGET_ILLIMITE,
  BudgetEpuise,
  FENETRE_JOURS,
  HORIZON_REQUIS_MS,
  PersistentTideProvider,
  couvre,
  fenetreDeRequete,
  type Budget,
  type Fetcher,
} from '../persistant';
import { MemoryTideTableStore, POINT_BREST } from '../store';
import { TideProviderWithFallback } from '../../fallback';
import { MockTideProvider } from '../../mock/tide';

/**
 * Le fournisseur persistant est ce qui rend le palier gratuit suffisant :
 * ces tests comptent les REQUÊTES, parce que c'est la seule chose qui
 * compte. Une régression ici ne casse aucune page — elle vide le quota en
 * silence, et le site repasse en « marées simulées » partout.
 */

const H = 3_600_000;
const J = 24 * H;
const spot = SPOTS.find((s) => s.slug === 'pen-hat')!;
const autre = SPOTS.find((s) => s.slug === 'la-torche')!;

const NOW = new Date('2026-09-24T09:00:00Z');
/** Ce qu'une page demande : sept jours, avec la marge de huit heures. */
const RANGE: DateRange = {
  from: new Date('2026-09-23T14:00:00Z'),
  to: new Date('2026-10-01T06:00:00Z'),
};

/** Une série d'extremums semi-diurne couvrant exactement la fenêtre demandée. */
function serie(range: DateRange, meanRange: number): TideExtreme[] {
  const out: TideExtreme[] = [];
  let i = 0;
  for (let t = range.from.getTime(); t < range.to.getTime(); t += 6.21 * H, i += 1) {
    const high = i % 2 === 0;
    out.push({
      time: new Date(t).toISOString(),
      heightM: 4 + (high ? meanRange / 2 : -meanRange / 2),
      type: high ? 'high' : 'low',
    });
  }
  return out;
}

class FauxFetcher implements Fetcher {
  appels: { label: string; range: DateRange }[] = [];
  /** Jours réellement rendus, pour simuler un fournisseur qui tronque. */
  horizonJours = FENETRE_JOURS;
  echoue = false;

  readonly source: SourceMeta = { name: 'Stormglass (faux)', kind: 'forecast', precision: '—' };

  async extremes(lat: number, _lng: number, range: DateRange, label: string): Promise<TideExtreme[]> {
    this.appels.push({ label, range });
    if (this.echoue) throw new Error('réseau coupé');
    const to = new Date(Math.min(range.to.getTime(), range.from.getTime() + this.horizonJours * J));
    return serie({ from: range.from, to }, lat === BREST_REFERENCE.lat ? 5.8 : 6.4);
  }
}

function budgetCompte(limite: number): Budget & { reserves: number; rendus: number } {
  const b = {
    reserves: 0,
    rendus: 0,
    async reserver() {
      if (b.reserves >= limite) return false;
      b.reserves += 1;
      return true;
    },
    async rendre() {
      b.rendus += 1;
      b.reserves -= 1;
    },
  };
  return b;
}

describe('fenetreDeRequete et couvre', () => {
  it('demande de la veille du début à FENETRE_JOURS après', () => {
    const f = fenetreDeRequete(RANGE);
    expect(f.from.toISOString()).toBe('2026-09-22T00:00:00.000Z');
    expect(f.to.getTime() - f.from.getTime()).toBe(FENETRE_JOURS * J);
  });

  it('juge la couverture sur les bornes observées, bornes incluses', () => {
    const table = {
      pointSlug: 'x',
      coversFrom: RANGE.from.toISOString(),
      coversTo: RANGE.to.toISOString(),
      extremes: [],
      sourceName: '',
      fetchedAt: '',
    };
    expect(couvre(table, RANGE)).toBe(true);
    expect(couvre({ ...table, coversTo: new Date(RANGE.to.getTime() - 1).toISOString() }, RANGE)).toBe(false);
    expect(couvre(null, RANGE)).toBe(false);
  });
});

describe('PersistentTideProvider — au rendu', () => {
  it('interroge le fournisseur la première fois, puis plus jamais tant que la table couvre', async () => {
    const fetcher = new FauxFetcher();
    const store = new MemoryTideTableStore();
    const provider = new PersistentTideProvider(fetcher, store, BUDGET_ILLIMITE, () => NOW);

    const premier = await provider.getTideEvents(spot, RANGE);
    expect(fetcher.appels.map((a) => a.label)).toStrictEqual([POINT_BREST, spot.slug]);
    expect(premier.data.length).toBeGreaterThan(20);
    expect(premier.source.kind).toBe('forecast');

    // Dix rendus de plus, le lendemain compris : aucune requête.
    for (let i = 0; i < 10; i += 1) await provider.getTideEvents(spot, RANGE);
    await provider.getTideEvents(spot, {
      from: new Date(RANGE.from.getTime() + J),
      to: new Date(RANGE.to.getTime() + J),
    });
    expect(fetcher.appels).toHaveLength(2);
  });

  it('ne demande qu’UNE fois un point manqué par dix rendus simultanés', async () => {
    /*
      Mesuré au build : huit processus manquaient Brest au même instant et
      la demandaient chacun — le budget du jour parti pour une seule table.
    */
    const fetcher = new FauxFetcher();
    const budget = budgetCompte(8);
    const provider = new PersistentTideProvider(fetcher, new MemoryTideTableStore(), budget, () => NOW);

    const resultats = await Promise.all(
      Array.from({ length: 10 }, () => provider.getTideEvents(spot, RANGE)),
    );

    expect(fetcher.appels.map((a) => a.label)).toStrictEqual([POINT_BREST, spot.slug]);
    expect(budget.reserves).toBe(2);
    for (const r of resultats) expect(r.data.length).toBeGreaterThan(20);
  });

  it('partage la table de Brest entre tous les spots', async () => {
    const fetcher = new FauxFetcher();
    const provider = new PersistentTideProvider(fetcher, new MemoryTideTableStore(), BUDGET_ILLIMITE, () => NOW);
    await provider.getTideEvents(spot, RANGE);
    await provider.getTideEvents(autre, RANGE);
    expect(fetcher.appels.filter((a) => a.label === POINT_BREST)).toHaveLength(1);
    expect(fetcher.appels).toHaveLength(3);
  });

  it('date la donnée du moment où elle a été DEMANDÉE, pas du rendu', async () => {
    const fetcher = new FauxFetcher();
    const provider = new PersistentTideProvider(fetcher, new MemoryTideTableStore(), BUDGET_ILLIMITE, () => NOW);
    const sourced = await provider.getTideEvents(spot, RANGE);
    expect(sourced.refreshedAt).toBe(NOW.toISOString());
  });

  it('lève quand le budget est épuisé, sans écrire de table tronquée', async () => {
    const fetcher = new FauxFetcher();
    const store = new MemoryTideTableStore();
    const budget = budgetCompte(1); // Brest passe, le spot non.
    const provider = new PersistentTideProvider(fetcher, store, budget, () => NOW);

    await expect(provider.getTideEvents(spot, RANGE)).rejects.toBeInstanceOf(BudgetEpuise);
    expect(await store.lire(POINT_BREST)).not.toBeNull();
    expect(await store.lire(spot.slug)).toBeNull();
  });

  it('rend la réservation quand la requête n’a pas abouti', async () => {
    const fetcher = new FauxFetcher();
    fetcher.echoue = true;
    const budget = budgetCompte(5);
    const provider = new PersistentTideProvider(fetcher, new MemoryTideTableStore(), budget, () => NOW);

    await expect(provider.getTideEvents(spot, RANGE)).rejects.toThrow('réseau coupé');
    expect(budget.reserves).toBe(0);
    expect(budget.rendus).toBe(1);
  });

  it('enregistre les bornes OBSERVÉES, pas celles demandées', async () => {
    const fetcher = new FauxFetcher();
    fetcher.horizonJours = 5; // Un fournisseur qui tronque.
    const store = new MemoryTideTableStore();
    const provider = new PersistentTideProvider(fetcher, store, BUDGET_ILLIMITE, () => NOW);

    // Cinq jours ne couvrent pas les sept demandés : le fournisseur direct
    // aurait déjà refusé ; ici la table est écrite, puis la couverture jugée.
    await provider.getTideEvents(spot, RANGE).catch(() => undefined);
    const table = await store.lire(spot.slug);
    expect(table).not.toBeNull();
    const dureeJours = (new Date(table!.coversTo).getTime() - new Date(table!.coversFrom).getTime()) / J;
    expect(dureeJours).toBeLessThan(5.1);
    expect(couvre(table, RANGE)).toBe(false);
  });
});

describe('PersistentTideProvider — ce que voit la page', () => {
  it('ne périme jamais : la couverture est garantie, pas devinée', async () => {
    const provider = new PersistentTideProvider(new FauxFetcher(), new MemoryTideTableStore(), BUDGET_ILLIMITE, () => NOW);
    expect(provider.source.validityHours).toBeNull();
    expect((await provider.getTideEvents(spot, RANGE)).source.validityHours).toBeNull();
  });

  it('un budget épuisé donne une marée simulée SANS voyant de panne', async () => {
    const provider = new PersistentTideProvider(new FauxFetcher(), new MemoryTideTableStore(), budgetCompte(0), () => NOW);
    const avecRepli = new TideProviderWithFallback(provider, new MockTideProvider());
    const sourced = await avecRepli.getTideEvents(spot, RANGE);
    expect(sourced.source.kind).toBe('simulated');
    expect(sourced.source.degraded).toBeUndefined();
    expect(sourced.source.name).toContain('en attendant');
  });

  it('une vraie panne réseau, elle, allume le voyant', async () => {
    const fetcher = new FauxFetcher();
    fetcher.echoue = true;
    const provider = new PersistentTideProvider(fetcher, new MemoryTideTableStore(), BUDGET_ILLIMITE, () => NOW);
    const avecRepli = new TideProviderWithFallback(provider, new MockTideProvider());
    const sourced = await avecRepli.getTideEvents(spot, RANGE);
    expect(sourced.source.kind).toBe('simulated');
    expect(sourced.source.degraded).toBe(true);
  });
});

describe('PersistentTideProvider — rafraîchissement d’entretien', () => {
  it('rafraîchit Brest d’abord, puis les points les moins couverts, dans la limite', async () => {
    const fetcher = new FauxFetcher();
    const store = new MemoryTideTableStore();
    const provider = new PersistentTideProvider(fetcher, store, BUDGET_ILLIMITE, () => NOW);

    const bilan = await provider.rafraichir(SPOTS, 8);
    expect(bilan.rafraichis[0]).toBe(POINT_BREST);
    expect(bilan.rafraichis).toHaveLength(8);
    expect(bilan.enAttente).toHaveLength(SPOTS.length + 1 - 8);
    expect(bilan.erreurs).toStrictEqual([]);
    expect(fetcher.appels).toHaveLength(8);
  });

  it('ne touche pas à une table qui couvre encore l’horizon requis', async () => {
    const fetcher = new FauxFetcher();
    const store = new MemoryTideTableStore();
    const provider = new PersistentTideProvider(fetcher, store, BUDGET_ILLIMITE, () => NOW);

    await provider.rafraichir(SPOTS, 100);
    const total = fetcher.appels.length;
    expect(total).toBe(SPOTS.length + 1);

    // Trois jours plus tard, tout couvre encore : rien à faire.
    const plusTard = new PersistentTideProvider(
      fetcher,
      store,
      BUDGET_ILLIMITE,
      () => new Date(NOW.getTime() + 3 * J),
    );
    const bilan = await plusTard.rafraichir(SPOTS, 100);
    expect(bilan.rafraichis).toStrictEqual([]);
    expect(bilan.aJour).toBe(SPOTS.length + 1);
    expect(fetcher.appels).toHaveLength(total);
  });

  it('en régime établi, tient dans le budget gratuit : moins de huit requêtes par jour en moyenne', async () => {
    /*
      C'est LE chiffre de cette fonctionnalité. On simule soixante jours
      d'entretien quotidien sur tout le catalogue et on compte.
    */
    const fetcher = new FauxFetcher();
    const store = new MemoryTideTableStore();
    let jour = 0;
    const provider = new PersistentTideProvider(
      fetcher,
      store,
      BUDGET_ILLIMITE,
      () => new Date(NOW.getTime() + jour * J),
    );

    // Remplissage initial, sans limite, pour partir d'un état couvert.
    await provider.rafraichir(SPOTS, 1000);
    const initial = fetcher.appels.length;

    for (jour = 1; jour <= 60; jour += 1) await provider.rafraichir(SPOTS, 8);

    const parJour = (fetcher.appels.length - initial) / 60;
    expect(parJour).toBeLessThan(8);
    expect(parJour).toBeGreaterThan(3);
  });

  it('s’arrête net quand le budget est épuisé, et dit qui attend', async () => {
    const fetcher = new FauxFetcher();
    const budget = budgetCompte(3);
    const provider = new PersistentTideProvider(fetcher, new MemoryTideTableStore(), budget, () => NOW);

    const bilan = await provider.rafraichir(SPOTS, 100);
    expect(bilan.rafraichis).toHaveLength(3);
    expect(bilan.erreurs).toHaveLength(1);
    expect(bilan.erreurs[0]!.message).toContain('épuisé');
    expect(bilan.rafraichis.length + bilan.enAttente.length).toBe(SPOTS.length + 1);
    expect(fetcher.appels).toHaveLength(3);
  });

  it('couvre bien HORIZON_REQUIS_MS après maintenant', async () => {
    const fetcher = new FauxFetcher();
    const store = new MemoryTideTableStore();
    const provider = new PersistentTideProvider(fetcher, store, BUDGET_ILLIMITE, () => NOW);
    await provider.rafraichir([spot], 10);
    const table = await store.lire(spot.slug);
    expect(new Date(table!.coversTo).getTime()).toBeGreaterThanOrEqual(NOW.getTime() + HORIZON_REQUIS_MS);
  });
});
