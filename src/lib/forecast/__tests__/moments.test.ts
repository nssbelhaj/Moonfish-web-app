import { describe, expect, it } from 'vitest';

import { SPOTS } from '@/data/spots';
import type { ForecastDay, ForecastSlot } from '../slots';
import { FENETRES, momentsFor } from '../moments';

/**
 * « Ce soir » et « demain matin » remplacent le podium de la page d'accueil.
 *
 * Les deux règles qui comptent ici ne sont pas des détails d'affichage :
 * un créneau DANGEREUX ne doit jamais être proposé, et un créneau PASSÉ non
 * plus. La première est la règle de sécurité du site, qui ne se dérive
 * d'aucun score ; la seconde est ce qui sépare un conseil d'un classement.
 */

const spot = SPOTS[0]!;
/** Un spot dans le même fuseau, pour comparer deux candidats. */
const autre = SPOTS.find((s) => s.timezone === spot.timezone && s.slug !== spot.slug)!;

function creneau(
  debutIso: string,
  valeur: number | null,
  danger = false,
): ForecastSlot {
  const debut = new Date(debutIso);
  return {
    start: debut.toISOString(),
    end: new Date(debut.getTime() + 2 * 3_600_000).toISOString(),
    score: {
      value: valeur,
      label: 'Bon',
      breakdown: {},
      reasons: [],
      safety: { level: danger ? 'danger' : 'ok', reasons: [] },
      coverage: 1,
    } as unknown as ForecastSlot['score'],
    conditions: null,
    tide: null,
    lightPhase: 'dusk',
  };
}

function jour(slots: ForecastSlot[]): ForecastDay {
  return {
    date: slots[0]!.start,
    slots,
    sunrise: null,
    sunset: null,
    moonrise: null,
    moonset: null,
  } as ForecastDay;
}

/* 2026-06-15 est un lundi ; l'heure d'été de Paris est UTC+2. */
const MAINTENANT = new Date('2026-06-15T12:00:00Z'); // 14 h à Paris

describe('les deux fenêtres', () => {
  it('couvrent le soir du jour même et la matinée du lendemain', () => {
    expect(FENETRES.map((f) => f.cle)).toStrictEqual(['ce-soir', 'demain-matin']);
    expect(FENETRES[0]!.joursApres).toBe(0);
    expect(FENETRES[1]!.joursApres).toBe(1);
  });
});

describe('momentsFor', () => {
  it('retient le meilleur créneau de chaque fenêtre', () => {
    const moments = momentsFor(
      [
        {
          spot,
          days: [
            jour([creneau('2026-06-15T17:00:00Z', 6.0)]), // 19 h Paris
            jour([creneau('2026-06-16T06:00:00Z', 7.0)]), // 8 h Paris
          ],
        },
        {
          spot: autre,
          days: [
            jour([creneau('2026-06-15T18:00:00Z', 8.5)]), // 20 h Paris
            jour([creneau('2026-06-16T05:00:00Z', 4.0)]), // 7 h Paris
          ],
        },
      ],
      MAINTENANT,
    );

    expect(moments.map((m) => m.cle)).toStrictEqual(['ce-soir', 'demain-matin']);
    expect(moments[0]!.spot.slug).toBe(autre.slug);
    expect(moments[0]!.slot.score.value).toBe(8.5);
    expect(moments[1]!.spot.slug).toBe(spot.slug);
    expect(moments[1]!.slot.score.value).toBe(7);
  });

  it('n’avance JAMAIS un créneau dangereux, même s’il est le mieux noté', () => {
    const moments = momentsFor(
      [
        {
          spot,
          days: [
            jour([
              creneau('2026-06-15T17:00:00Z', 9.8, true),
              creneau('2026-06-15T19:00:00Z', 5.1),
            ]),
          ],
        },
      ],
      MAINTENANT,
    );

    expect(moments).toHaveLength(1);
    expect(moments[0]!.slot.score.value).toBe(5.1);
    expect(moments[0]!.slot.score.safety.level).not.toBe('danger');
  });

  it('ignore un créneau déjà terminé', () => {
    // 09 h UTC = 11 h à Paris : terminé à 13 h, avant les 14 h de MAINTENANT.
    const moments = momentsFor(
      [{ spot, days: [jour([creneau('2026-06-16T09:00:00Z', 9)])] }],
      new Date('2026-06-16T12:00:00Z'),
    );
    expect(moments).toStrictEqual([]);
  });

  it('écarte un score indisponible plutôt que de le compter pour zéro', () => {
    const moments = momentsFor(
      [
        {
          spot,
          days: [
            jour([creneau('2026-06-15T17:00:00Z', null), creneau('2026-06-15T19:00:00Z', 3.2)]),
          ],
        },
      ],
      MAINTENANT,
    );
    expect(moments).toHaveLength(1);
    expect(moments[0]!.slot.score.value).toBe(3.2);
  });

  it('rend une fenêtre sans candidat comme ABSENTE, sans créneau de repli', () => {
    // Rien que de la nuit profonde : hors des deux fenêtres.
    const moments = momentsFor(
      [{ spot, days: [jour([creneau('2026-06-16T00:00:00Z', 9.9)])] }],
      MAINTENANT,
    );
    expect(moments).toStrictEqual([]);
  });

  it('ne rend rien sur un catalogue vide', () => {
    expect(momentsFor([], MAINTENANT)).toStrictEqual([]);
  });
});
