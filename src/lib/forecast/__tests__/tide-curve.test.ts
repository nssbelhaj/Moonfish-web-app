import { describe, expect, it } from 'vitest';
import type { TideEvent } from '@/data/schemas';
import { eventsAround, sampleTideCurve, tidalRangeOf, tideBounds, tideHeightAt } from '../tide-curve';

const H = 3_600_000;
const T0 = Date.UTC(2026, 8, 1, 0, 0, 0);

const events: TideEvent[] = [
  { time: new Date(T0).toISOString(), type: 'low', heightM: 1, coefficient: 80 },
  { time: new Date(T0 + 6 * H).toISOString(), type: 'high', heightM: 7, coefficient: 80 },
  { time: new Date(T0 + 12 * H).toISOString(), type: 'low', heightM: 1, coefficient: 80 },
];

describe('courbe de marée', () => {
  it('passe exactement par les extremums', () => {
    expect(tideHeightAt(new Date(T0), events)).toBeCloseTo(1, 6);
    expect(tideHeightAt(new Date(T0 + 6 * H), events)).toBeCloseTo(7, 6);
    expect(tideHeightAt(new Date(T0 + 12 * H), events)).toBeCloseTo(1, 6);
  });

  it('place la mi-hauteur à mi-parcours', () => {
    expect(tideHeightAt(new Date(T0 + 3 * H), events)).toBeCloseTo(4, 6);
  });

  /**
   * Le comportement qui distingue une interpolation cosinusoïdale d'une droite,
   * et qui compte sur le terrain : la moitié de la hauteur se joue dans les deux
   * heures centrales, pas régulièrement sur les six.
   */
  it('monte plus vite au milieu qu’aux extrémités', () => {
    const h1 = tideHeightAt(new Date(T0 + 1 * H), events) as number;
    const h2 = tideHeightAt(new Date(T0 + 2 * H), events) as number;
    const h3 = tideHeightAt(new Date(T0 + 3 * H), events) as number;
    const h4 = tideHeightAt(new Date(T0 + 4 * H), events) as number;

    const firstHour = h1 - 1;
    const thirdHour = h3 - h2;
    expect(thirdHour).toBeGreaterThan(firstHour * 1.5);
    // Symétrie autour de la pleine mer.
    expect(h2 - 1).toBeCloseTo(7 - h4, 6);
  });

  it('n’extrapole pas hors de la plage connue', () => {
    expect(tideHeightAt(new Date(T0 - H), events)).toBeNull();
    expect(tideHeightAt(new Date(T0 + 13 * H), events)).toBeNull();
    expect(tideHeightAt(new Date(T0), [])).toBeNull();
  });

  it('échantillonne une courbe continue et monotone par demi-cycle', () => {
    const samples = sampleTideCurve(events, new Date(T0), new Date(T0 + 6 * H), 24);
    expect(samples).toHaveLength(25);
    for (let i = 1; i < samples.length; i += 1) {
      expect(samples[i]!.heightM).toBeGreaterThan(samples[i - 1]!.heightM);
    }
  });

  it('borne le tracé avec une marge', () => {
    const bounds = tideBounds(events);
    expect(bounds).not.toBeNull();
    expect(bounds!.min).toBeLessThan(1);
    expect(bounds!.max).toBeGreaterThan(7);
  });

  it('récupère l’extremum de part et d’autre pour fermer la courbe', () => {
    const window = eventsAround(events, new Date(T0 + 7 * H), new Date(T0 + 8 * H));
    // Aucun extremum dans la fenêtre, mais un de chaque côté.
    expect(window).toHaveLength(2);
    expect(window[0]?.type).toBe('high');
    expect(window[1]?.type).toBe('low');
  });
});

describe('marnage effectif', () => {
  it('mesure l’écart entre la plus haute pleine mer et la plus basse basse mer', () => {
    expect(tidalRangeOf(events)).toBeCloseTo(6, 6);
  });

  it('rend null quand il manque une pleine ou une basse mer', () => {
    expect(tidalRangeOf([])).toBeNull();
    expect(tidalRangeOf(events.filter((e) => e.type === 'high'))).toBeNull();
  });
});
