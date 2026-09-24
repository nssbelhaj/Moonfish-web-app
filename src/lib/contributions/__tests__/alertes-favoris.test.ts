import { describe, expect, it } from 'vitest';

import type { ForecastDay, ForecastSlot } from '@/lib/forecast';
import { creneauAAnnoncer } from '../alertes-favoris';

/**
 * Le choix du créneau à annoncer, sans base ni courriel : la partie qui
 * décide si un message part, et laquelle. Un message de trop use la
 * confiance ; un danger annoncé comme bon serait pire.
 */
const NOW = new Date('2026-09-24T12:00:00Z');
const H = 3_600_000;

function slot(startOffsetH: number, value: number | null, danger = false): ForecastSlot {
  const start = new Date(NOW.getTime() + startOffsetH * H);
  return {
    start: start.toISOString(),
    end: new Date(start.getTime() + 2 * H).toISOString(),
    score: {
      value,
      label: 'Bon',
      breakdown: {},
      reasons: [],
      safety: { level: danger ? 'danger' : 'ok', reasons: [] },
      coverage: 1,
    } as unknown as ForecastSlot['score'],
    conditions: null,
    tide: null,
    lightPhase: 'day',
  };
}

function jours(...slots: ForecastSlot[]): ForecastDay[] {
  return [{ date: NOW.toISOString(), slots, sunrise: null, sunset: null, moonrise: null, moonset: null } as ForecastDay];
}

describe('creneauAAnnoncer', () => {
  it('rend le MEILLEUR créneau qui atteint le seuil, pas le premier', () => {
    const d = jours(slot(2, 7.1), slot(18, 8.4), slot(20, 7.9));
    expect(creneauAAnnoncer(d, NOW, 7, null)?.score.value).toBe(8.4);
  });

  it('ne rend rien sous le seuil', () => {
    expect(creneauAAnnoncer(jours(slot(2, 6.9)), NOW, 7, null)).toBeNull();
  });

  it('n’annonce JAMAIS un créneau dangereux, même à 9,8', () => {
    expect(creneauAAnnoncer(jours(slot(2, 9.8, true)), NOW, 7, null)).toBeNull();
    // Et il ne masque pas un créneau sûr moins bien noté.
    expect(creneauAAnnoncer(jours(slot(2, 9.8, true), slot(6, 7.5)), NOW, 7, null)?.score.value).toBe(7.5);
  });

  it('ignore un créneau passé ou au-delà de l’horizon', () => {
    expect(creneauAAnnoncer(jours(slot(-1, 9)), NOW, 7, null)).toBeNull();
    expect(creneauAAnnoncer(jours(slot(37, 9)), NOW, 7, null)).toBeNull();
    expect(creneauAAnnoncer(jours(slot(35, 9)), NOW, 7, null)).not.toBeNull();
  });

  it('n’annonce pas deux fois le même créneau', () => {
    const d = jours(slot(18, 8.4));
    const premier = creneauAAnnoncer(d, NOW, 7, null)!;
    expect(creneauAAnnoncer(d, NOW, 7, premier.start)).toBeNull();
  });

  it('annonce un créneau DIFFÉRENT après un premier, parce que c’est une information nouvelle', () => {
    const d = jours(slot(18, 8.4), slot(30, 8.9));
    const premier = creneauAAnnoncer(d, NOW, 7, null)!;
    expect(premier.score.value).toBe(8.9);
    // La prévision a bougé : le meilleur est maintenant à 18 h.
    const suivant = creneauAAnnoncer(jours(slot(18, 8.4), slot(30, 6)), NOW, 7, premier.start);
    expect(suivant?.score.value).toBe(8.4);
  });

  it('écarte un score indisponible plutôt que de le compter pour zéro ou dix', () => {
    expect(creneauAAnnoncer(jours(slot(2, null)), NOW, 7, null)).toBeNull();
  });
});
