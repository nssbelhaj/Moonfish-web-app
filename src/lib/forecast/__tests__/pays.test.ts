import { describe, expect, it } from 'vitest';

import { PAYS, SPOTS } from '@/data/spots';
import { getSpotForecast } from '@/lib/forecast';
import { ancreDuJour, resumePays, semaineDe } from '../pays';
import type { SpotForecast } from '../index';

const NOW = new Date('2026-09-22T09:00:00Z');

/**
 * Le direct d'un pays est DÉRIVÉ des prévisions : ces tests vérifient qu'il
 * choisit juste, et surtout qu'il ne choisit jamais un spot en danger.
 */
describe('resumePays', () => {
  it('ne garde que les spots du pays demandé', async () => {
    const forecasts = await Promise.all(SPOTS.map((spot) => getSpotForecast(spot, NOW)));
    for (const pays of PAYS) {
      const resume = resumePays(pays, forecasts, NOW);
      const slugs = new Set(pays.spots.map((spot) => spot.slug));
      if (resume.meilleur) expect(slugs.has(resume.meilleur.spot.slug)).toBe(true);
      for (const moment of resume.moments) expect(slugs.has(moment.spot.slug)).toBe(true);
      expect(resume.marees.reelles.length + resume.marees.simulees.length).toBe(pays.spots.length);
    }
  });

  it('n’élit JAMAIS un spot en danger comme meilleur, même au score le plus haut', async () => {
    const pays = PAYS[0]!;
    const forecasts = await Promise.all(pays.spots.map((spot) => getSpotForecast(spot, NOW)));

    // On truque le premier : score parfait, mais danger.
    const truque: SpotForecast = {
      ...forecasts[0]!,
      current: {
        ...forecasts[0]!.current!,
        score: {
          ...forecasts[0]!.current!.score,
          value: 10,
          safety: { level: 'danger', message: 'Houle 4 m', reasons: [] },
        },
      },
    } as SpotForecast;

    const resume = resumePays(pays, [truque, ...forecasts.slice(1)], NOW);
    expect(resume.meilleur?.spot.slug).not.toBe(truque.spot.slug);
  });

  it('rend `meilleur` nul quand aucun score n’est calculable', () => {
    const pays = PAYS[0]!;
    expect(resumePays(pays, [], NOW).meilleur).toBeNull();
    expect(resumePays(pays, [], NOW).semaine).toStrictEqual([]);
  });
});

describe('semaineDe', () => {
  it('donne un score par jour, égal au meilleur créneau praticable', async () => {
    const forecast = await getSpotForecast(SPOTS[0]!, NOW);
    const semaine = semaineDe(forecast);
    expect(semaine).toHaveLength(forecast.days.length);

    semaine.forEach((jour, i) => {
      const praticables = forecast.days[i]!.slots.filter(
        (s) => s.score.value !== null && s.score.safety.level !== 'danger',
      );
      const attendu = praticables.length === 0 ? null : Math.max(...praticables.map((s) => s.score.value!));
      expect(jour.meilleur).toBe(attendu);
    });
  });

  it('marque « danger » un jour qui n’a QUE des créneaux dangereux', async () => {
    const forecast = await getSpotForecast(SPOTS[0]!, NOW);
    const jour = forecast.days[0]!;
    const tousDangereux = {
      ...forecast,
      days: [
        {
          ...jour,
          slots: jour.slots.map((s) => ({
            ...s,
            score: { ...s.score, value: 9, safety: { ...s.score.safety, level: 'danger' as const } },
          })),
        },
      ],
    } as SpotForecast;

    expect(semaineDe(tousDangereux)[0]).toMatchObject({ meilleur: null, danger: true });
  });
});

describe('ancreDuJour', () => {
  it('suit le format des ancres de la page de prévision, en date LOCALE', () => {
    // Minuit parisien du 3 septembre est encore le 2 en UTC.
    expect(ancreDuJour('2026-09-02T22:00:00.000Z', 'Europe/Paris')).toBe('jour-2026-09-03');
  });
});
