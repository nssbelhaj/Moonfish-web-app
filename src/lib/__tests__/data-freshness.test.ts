import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_VALIDITY_HOURS,
  formatAge,
  freshnessOf,
  validityHoursOf,
} from '@/lib/data-freshness';
import type { SourceMeta } from '@/lib/providers';

const NOW = new Date('2026-09-01T12:00:00Z');

function source(patch: Partial<SourceMeta> = {}): SourceMeta {
  return { name: 'Test', kind: 'forecast', precision: 'peu importe', ...patch };
}

function hoursAgo(hours: number): string {
  return new Date(NOW.getTime() - hours * 3_600_000).toISOString();
}

describe('fraîcheur — les quatre états', () => {
  it('dit « à jour » dans la fenêtre de validité', () => {
    const f = freshnessOf(source({ kind: 'forecast' }), hoursAgo(2), NOW);
    expect(f.state).toBe('fresh');
    expect(f.label).toBe('À jour');
  });

  it('dit « ancien » au-delà', () => {
    const f = freshnessOf(source({ kind: 'forecast' }), hoursAgo(7), NOW);
    expect(f.state).toBe('stale');
    expect(f.label).toBe('Ancien');
  });

  it('dit « interrompu » sur un repli après panne, quel que soit l’âge', () => {
    const f = freshnessOf(
      source({ kind: 'simulated', degraded: true }),
      hoursAgo(0),
      NOW,
    );
    expect(f.state).toBe('interrupted');
  });

  it('dit « en attente » quand la date est absente ou illisible', () => {
    expect(freshnessOf(source(), null, NOW).state).toBe('pending');
    expect(freshnessOf(source(), 'pas une date', NOW).state).toBe('pending');
  });
});

describe('fraîcheur — ce qui ne doit PAS s’allumer', () => {
  it('ne marque jamais « ancien » un calcul local', () => {
    // L'astronomie est recalculée à chaque rendu : elle ne peut pas vieillir.
    const f = freshnessOf(source({ kind: 'computed' }), hoursAgo(400), NOW);
    expect(f.state).toBe('fresh');
    expect(f.ageHours).toBeNull();
  });

  it('ne marque pas « interrompu » un fournisseur simulé délibérément', () => {
    // Le mode démo n'est pas une panne : allumer un voyant rouge en permanence
    // apprendrait à l'ignorer le jour où il compte.
    const f = freshnessOf(source({ kind: 'simulated' }), hoursAgo(30), NOW);
    expect(f.state).not.toBe('interrupted');
    expect(f.state).toBe('fresh');
  });

  it('ne marque pas « ancien » une table de marée de la veille', () => {
    // Les marées sont mises en cache 24 à 72 h EXPRÈS : c'est de l'astronomie
    // prédite des mois à l'avance, un cache long ne lui fait rien perdre. La
    // source déclare donc sa propre validité, bien plus longue que le défaut de
    // son `kind` — que la météo, elle, garde.
    const tide = source({ kind: 'forecast', validityHours: 72 });
    expect(freshnessOf(tide, hoursAgo(30), NOW).state).toBe('fresh');

    const meteo = source({ kind: 'forecast' });
    expect(freshnessOf(meteo, hoursAgo(30), NOW).state).toBe('stale');
  });

  it('laisse la source primer sur le défaut de sa nature', () => {
    expect(validityHoursOf(source({ kind: 'forecast' }))).toBe(
      DEFAULT_VALIDITY_HOURS.forecast,
    );
    expect(validityHoursOf(source({ kind: 'forecast', validityHours: 72 }))).toBe(72);
    // Une source peut aussi se déclarer impérissable, quel que soit son kind.
    expect(validityHoursOf(source({ kind: 'forecast', validityHours: null }))).toBeNull();
  });
});

describe('fraîcheur — les bornes', () => {
  it('bascule exactement au seuil, pas avant', () => {
    const kind = 'measured' as const;
    const limit = DEFAULT_VALIDITY_HOURS[kind]!;
    expect(freshnessOf(source({ kind }), hoursAgo(limit), NOW).state).toBe('fresh');
    expect(freshnessOf(source({ kind }), hoursAgo(limit + 0.01), NOW).state).toBe('stale');
  });

  it('traite un horodatage futur comme un âge nul, jamais négatif', () => {
    const future = new Date(NOW.getTime() + 3_600_000).toISOString();
    const f = freshnessOf(source(), future, NOW);
    expect(f.ageHours).toBe(0);
    expect(f.state).toBe('fresh');
  });
});

describe('formatAge', () => {
  it('n’invente pas de précision à la seconde', () => {
    expect(formatAge(0)).toBe('à l’instant');
    expect(formatAge(0.5)).toBe('il y a 30 min');
    expect(formatAge(1)).toBe('il y a 1 h');
    expect(formatAge(2 + 10 / 60)).toBe('il y a 2 h 10');
    expect(formatAge(25)).toBe('il y a 1 jour');
    expect(formatAge(50)).toBe('il y a 2 jours');
  });

  it('n’écrit jamais de point décimal', () => {
    for (const hours of [0.2, 1.5, 3.75, 26.4, 100]) {
      expect(formatAge(hours)).not.toMatch(/\d\.\d/);
    }
  });
});

describe('la couleur n’est jamais le seul canal (R3)', () => {
  it('donne un libellé distinct à chacun des quatre états', () => {
    const labels = [
      freshnessOf(source({ kind: 'forecast' }), hoursAgo(1), NOW).label,
      freshnessOf(source({ kind: 'forecast' }), hoursAgo(99), NOW).label,
      freshnessOf(source({ kind: 'simulated', degraded: true }), hoursAgo(1), NOW).label,
      freshnessOf(source({ kind: 'forecast' }), null, NOW).label,
    ];

    expect(new Set(labels).size).toBe(4);
    for (const label of labels) expect(label.trim().length).toBeGreaterThan(0);
  });

  it('affiche ce libellé dans la puce, pas seulement la pastille', () => {
    // Garde-fou de source, comme `color-classes.test.ts` : la pastille de
    // couleur est `aria-hidden`, donc si le libellé disparaissait du rendu,
    // l'état ne serait plus transmis du tout — ni à l'œil qui ne distingue pas
    // l'ambre du corail, ni au lecteur d'écran.
    const chip = readFileSync(
      path.join(process.cwd(), 'src/components/data/FreshnessChip.tsx'),
      'utf8',
    );
    expect(chip).toContain('{freshness.label}');
    expect(chip).toMatch(/aria-hidden="true"/);
  });
});
