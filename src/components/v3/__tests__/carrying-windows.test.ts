import { describe, expect, it } from 'vitest';
import { SPOTS } from '@/data/spots';
import { buildForecastDays } from '@/lib/forecast';
import { generateMarineSeries } from '@/data/generators/marine';
import { generateTideEvents } from '@/data/generators/tide';
import { activityLevel } from '@/lib/score-display';
import { carryingWindows } from '../TideActivityChart';

const NOW = new Date('2026-09-01T09:00:00Z');
const FROM = new Date('2026-08-31T00:00:00Z');
const TO = new Date('2026-09-08T00:00:00Z');

const spot = SPOTS.find((s) => s.slug === 'le-dossen') ?? SPOTS[0]!;
const days = buildForecastDays(
  spot,
  NOW,
  generateTideEvents(spot, FROM, TO),
  generateMarineSeries(spot, FROM, TO),
);

describe('fenêtres porteuses', () => {
  it('ne retient que les créneaux au palier « Bon » ou mieux', () => {
    for (const day of days) {
      for (const w of carryingWindows(day)) {
        expect(w.level).toBeGreaterThanOrEqual(2);
        expect(w.value).toBeGreaterThanOrEqual(6);
      }
    }
  });

  it('fusionne les créneaux contigus en une seule fenêtre', () => {
    // Deux tranches de deux heures qui se suivent ne sont pas deux sorties :
    // c'est une fenêtre de quatre heures. Les afficher séparément collait deux
    // pastilles bord à bord et écrivait « 14–16h16–18h » sans espace — le
    // découpage technique fuyait dans l'interface.
    for (const day of days) {
      const windows = carryingWindows(day, 12);
      for (let i = 0; i < windows.length - 1; i++) {
        const end = new Date(windows[i]!.end).getTime();
        const nextStart = new Date(windows[i + 1]!.start).getTime();
        expect(nextStart).toBeGreaterThan(end);
      }
    }
  });

  it('donne à une fenêtre fusionnée le MEILLEUR palier de ses créneaux', () => {
    // C'est ce qu'on va y chercher, pas la moyenne de ce qu'on y traverse.
    for (const day of days) {
      for (const w of carryingWindows(day, 12)) {
        const inside = day.slots.filter(
          (s) =>
            new Date(s.start).getTime() >= new Date(w.start).getTime() &&
            new Date(s.end).getTime() <= new Date(w.end).getTime(),
        );
        const best = Math.max(...inside.map((s) => activityLevel(s.score.value)));
        expect(w.level).toBe(best);
      }
    }
  });

  it('n’en rend jamais plus que demandé', () => {
    for (const day of days) {
      expect(carryingWindows(day, 2).length).toBeLessThanOrEqual(2);
      expect(carryingWindows(day, 4).length).toBeLessThanOrEqual(4);
    }
  });

  it('garde l’ordre chronologique après sélection des meilleures', () => {
    for (const day of days) {
      const windows = carryingWindows(day, 2);
      for (let i = 0; i < windows.length - 1; i++) {
        expect(new Date(windows[i]!.start).getTime()).toBeLessThan(
          new Date(windows[i + 1]!.start).getTime(),
        );
      }
    }
  });

  it('écarte les créneaux dangereux, quel que soit leur score', () => {
    for (const day of days) {
      const dangerous = new Set(
        day.slots.filter((s) => s.score.safety.level === 'danger').map((s) => s.start),
      );
      for (const w of carryingWindows(day, 12)) {
        expect(dangerous.has(w.start)).toBe(false);
      }
    }
  });

  it('rend une liste vide plutôt qu’une fenêtre médiocre', () => {
    // Une journée sans rien de porteur doit le DIRE. Descendre le seuil pour
    // avoir quelque chose à montrer serait exactement la fabrication qu'on
    // s'interdit partout ailleurs.
    const plat = {
      ...days[0]!,
      slots: days[0]!.slots.map((s) => ({ ...s, score: { ...s.score, value: 3.2 } })),
    };
    expect(carryingWindows(plat)).toStrictEqual([]);
  });
});
