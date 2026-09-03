import { describe, expect, it } from 'vitest';

import type { Catch } from '@/data/schemas';
import { formatMonth, summarizeCatches } from '../catch-log';

function prise(partial: Partial<Catch> & { caughtAt: string }): Catch {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    spotSlug: 'pen-hat',
    userId: '00000000-0000-4000-8000-0000000000aa',
    authorName: 'Alice',
    species: 'Bar',
    lengthCm: null,
    weightG: null,
    released: false,
    note: null,
    photoPath: null,
    createdAt: partial.caughtAt,
    ...partial,
  };
}

const NOW = new Date('2026-09-03T12:00:00Z');

describe('summarizeCatches', () => {
  it('rend un carnet vide sans inventer de zéro pour cent', () => {
    const s = summarizeCatches([], NOW);

    expect(s.total).toBe(0);
    // `null`, pas 0 : « aucune prise » et « 0 % relâchées » ne veulent pas dire
    // la même chose, et le second se lirait comme un jugement.
    expect(s.releaseRate).toBeNull();
    expect(s.longest).toBeNull();
    expect(s.byMonth).toHaveLength(12);
    expect(s.byMonth.every((m) => m.count === 0)).toBe(true);
  });

  it('compte par espèce sans tenir compte de la casse', () => {
    const s = summarizeCatches(
      [
        prise({ species: 'Bar', caughtAt: '2026-08-01T10:00:00Z', lengthCm: 52 }),
        prise({ species: 'bar', caughtAt: '2026-08-02T10:00:00Z', lengthCm: 61 }),
        prise({ species: 'Dorade royale', caughtAt: '2026-08-03T10:00:00Z' }),
      ],
      NOW,
    );

    expect(s.distinctSpecies).toBe(2);
    expect(s.bySpecies[0]).toMatchObject({ species: 'Bar', count: 2, bestLengthCm: 61 });
    expect(s.longest?.lengthCm).toBe(61);
  });

  it('classe les spots par nombre de prises et garde la date la plus récente', () => {
    const s = summarizeCatches(
      [
        prise({ spotSlug: 'la-torche', caughtAt: '2026-07-01T10:00:00Z' }),
        prise({ spotSlug: 'pen-hat', caughtAt: '2026-07-02T10:00:00Z' }),
        prise({ spotSlug: 'pen-hat', caughtAt: '2026-08-15T10:00:00Z' }),
      ],
      NOW,
    );

    expect(s.bySpot[0]).toMatchObject({ spotSlug: 'pen-hat', count: 2, lastAt: '2026-08-15T10:00:00Z' });
  });

  it('remplit douze mois, du plus ancien au plus récent, mois vides compris', () => {
    const s = summarizeCatches(
      [
        prise({ caughtAt: '2026-09-01T10:00:00Z' }),
        prise({ caughtAt: '2026-09-02T10:00:00Z' }),
        // Trop ancienne pour la fenêtre : ne doit pas apparaître.
        prise({ caughtAt: '2025-01-01T10:00:00Z' }),
      ],
      NOW,
    );

    expect(s.byMonth[0]?.month).toBe('2025-10');
    expect(s.byMonth[11]).toStrictEqual({ month: '2026-09', count: 2 });
    // La prise trop ancienne compte dans le total, pas dans la fenêtre.
    expect(s.total).toBe(3);
  });

  it('calcule la part relâchée', () => {
    const s = summarizeCatches(
      [
        prise({ caughtAt: '2026-08-01T10:00:00Z', released: true }),
        prise({ caughtAt: '2026-08-02T10:00:00Z', released: true }),
        prise({ caughtAt: '2026-08-03T10:00:00Z', released: false }),
        prise({ caughtAt: '2026-08-04T10:00:00Z', released: false }),
      ],
      NOW,
    );

    expect(s.releaseRate).toBe(0.5);
    expect(s.released).toBe(2);
  });

  it('identifie la première et la dernière prise quel que soit l’ordre reçu', () => {
    const s = summarizeCatches(
      [
        prise({ caughtAt: '2026-08-20T10:00:00Z', note: 'dernière' }),
        prise({ caughtAt: '2026-06-01T10:00:00Z', note: 'première' }),
      ],
      NOW,
    );

    expect(s.first?.note).toBe('première');
    expect(s.last?.note).toBe('dernière');
  });
});

describe('formatMonth', () => {
  it('écrit un mois en français court', () => {
    expect(formatMonth('2026-10')).toMatch(/oct\.? 2026/);
  });
});
