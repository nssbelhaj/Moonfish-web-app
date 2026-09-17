import { describe, expect, it } from 'vitest';

import { SPOTS } from '@/data/spots';
import { getSpotForecast } from '@/lib/forecast';
import { computeScore } from '@/lib/scoring';
import { creneauEnJson, previsionEnJson } from '@/lib/api/serialisation';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  LA règle du produit, vue depuis le JSON
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * « Houle > 2,5 m OU vent > 50 km/h ⇒ danger », et la sécurité s'affiche
 * AU-DESSUS du score, jamais à côté. Sur le site, la forme du composant le
 * garantit. Dans une API, c'est la FORME DU JSON qui doit le garantir : un
 * client qui reçoit `score.safety` finira par la traiter comme une propriété
 * du score — par la masquer quand le score est bon, par l'oublier quand le
 * score est absent.
 *
 * Ces tests refusent donc que `safety` retourne à l'intérieur de `score`, et
 * vérifient qu'elle survit à la sérialisation même quand tout le reste va
 * bien.
 */

const MAINTENANT = new Date('2026-09-01T09:00:00Z');
const spot = SPOTS[0]!;

/** Un créneau dont le score est excellent ET la mer impraticable. */
function creneauDangereuxMaisBienNote() {
  const score = computeScore({
    spotFacingDeg: spot.facingDeg,
    // Marée, lune et lumière au meilleur : le score monte.
    tide: { hoursFromHighTide: -1, coefficient: 85, state: 'falling' },
    solunar: {
      hoursToMajorPeriod: 0,
      hoursToMinorPeriod: 0,
      moonIlluminationPct: 100,
      moonAgeDays: 14.7,
    },
    light: { phase: 'dawn' },
    pressure: { hPa: 1012, trend3hHpa: -1.2 },
    // Et la mer est dangereuse.
    swell: { heightM: 3.4, periodS: 11 },
    wind: { speedKmh: 62, fromDeg: spot.facingDeg },
  });

  return {
    start: '2026-09-01T06:00:00.000Z',
    end: '2026-09-01T08:00:00.000Z',
    score,
    conditions: null,
    tide: null,
    lightPhase: 'dawn' as const,
  };
}

describe('la sécurité n’est pas une propriété du score', () => {
  it('ne laisse AUCUN champ « safety » à l’intérieur de « score »', async () => {
    const json = previsionEnJson(await getSpotForecast(spot, MAINTENANT));

    for (const jour of json.days) {
      for (const creneau of jour.slots) {
        expect(
          Object.keys(creneau.score),
          'safety a été remise dans le score : un client finira par la dériver de lui',
        ).not.toContain('safety');
      }
    }
  });

  it('publie « safety » comme frère de « score », sur chaque créneau', async () => {
    const json = previsionEnJson(await getSpotForecast(spot, MAINTENANT));
    const creneaux = json.days.flatMap((jour) => jour.slots);

    expect(creneaux.length).toBeGreaterThan(0);

    for (const creneau of creneaux) {
      expect(Object.keys(creneau)).toContain('safety');
      expect(['ok', 'prudence', 'danger']).toContain(creneau.safety.level);
    }
  });

  it('garde le verdict « danger » sur un créneau dont le score est excellent', () => {
    const creneau = creneauDangereuxMaisBienNote();

    // Le score est bon : c'est tout l'intérêt du cas.
    expect(creneau.score.value).not.toBeNull();
    expect(creneau.score.value!).toBeGreaterThanOrEqual(6);

    const json = creneauEnJson(creneau);

    expect(json.safety.level).toBe('danger');
    expect(json.safety.message).toContain('Ne pêchez pas');
  });

  it('survit à un aller-retour JSON : c’est ce que le téléphone reçoit vraiment', () => {
    const json = JSON.parse(JSON.stringify(creneauEnJson(creneauDangereuxMaisBienNote())));

    expect(json.safety.level).toBe('danger');
    expect(json.score.safety).toBeUndefined();
  });

  it('rend « message: null », jamais un champ absent, quand il n’y a rien à dire', () => {
    const creneau = {
      start: '2026-09-01T06:00:00.000Z',
      end: '2026-09-01T08:00:00.000Z',
      score: computeScore({
        spotFacingDeg: spot.facingDeg,
        tide: { hoursFromHighTide: -1, coefficient: 80, state: 'falling' },
        wind: { speedKmh: 14, fromDeg: spot.facingDeg },
        swell: { heightM: 0.9, periodS: 8 },
        solunar: {
          hoursToMajorPeriod: 3,
          hoursToMinorPeriod: 2,
          moonIlluminationPct: 40,
          moonAgeDays: 7,
        },
        pressure: { hPa: 1015, trend3hHpa: -0.6 },
        light: { phase: 'day' },
      }),
      conditions: null,
      tide: null,
      lightPhase: 'day' as const,
    };

    const json = creneauEnJson(creneau);

    expect(json.safety.level).toBe('ok');
    /*
      `null` et non `undefined` : `JSON.stringify` efface les `undefined`, et
      le champ disparaîtrait de la réponse. Un client typé strictement verrait
      alors une forme différente selon le verdict.
    */
    expect(json.safety.message).toBeNull();
    expect(Object.keys(json.safety)).toContain('message');
  });

  it('ne peut pas rendre « ok » quand la houle ou le vent manquent', () => {
    const sansMesure = creneauEnJson({
      start: '2026-09-01T06:00:00.000Z',
      end: '2026-09-01T08:00:00.000Z',
      score: computeScore({
        spotFacingDeg: spot.facingDeg,
        tide: { hoursFromHighTide: -1, coefficient: 80, state: 'falling' },
        wind: null,
        swell: null,
        solunar: null,
        pressure: null,
        light: { phase: 'day' },
      }),
      conditions: null,
      tide: null,
      lightPhase: 'day' as const,
    });

    // L'absence de donnée n'est pas une preuve de mer praticable.
    expect(sansMesure.safety.level).toBe('prudence');
    expect(sansMesure.safety.message).toContain('absence de donnée');
  });
});
