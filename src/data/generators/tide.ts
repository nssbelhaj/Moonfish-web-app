import { moonAgeDays, SYNODIC_MONTH_D } from '@/lib/astro';
import { hashString, mulberry32 } from '@/lib/random';
import type { Spot, TideEvent } from '../schemas';

/** Période de l'onde semi-diurne lunaire M2, en heures. */
export const M2_PERIOD_H = 12.4206;
const MS_PER_HOUR = 3_600_000;

/** Origine arbitraire mais fixe du modèle de marée : 1er janvier 2024, 00 h UTC. */
const TIDE_EPOCH_MS = Date.UTC(2024, 0, 1);

/**
 * Coefficient de marée du jour.
 *
 * En France, le coefficient est une valeur NATIONALE rapportée à Brest : il ne
 * dépend pas du spot, seulement de la date. Le modèle suit la lunaison avec le
 * retard de deux jours des vives-eaux sur la syzygie, qui est un fait
 * d'observation et non un ajustement cosmétique.
 */
export function tideCoefficientFor(date: Date): number {
  const laggedAge = moonAgeDays(new Date(date.getTime() - 2 * 24 * MS_PER_HOUR));
  const syzygy = Math.abs(Math.cos((2 * Math.PI * laggedAge) / SYNODIC_MONTH_D));
  return Math.round(28 + 87 * syzygy);
}

/**
 * Marnage du jour, en mètres.
 *
 * Le marnage ne varie PAS proportionnellement au coefficient : un coefficient
 * de 120 ne double pas le marnage d'un coefficient de 60. La relation réelle
 * est affine, et l'ignorer produisait des pleines mers de dix mètres à Crozon
 * et des basses mers négatives — or les cotes françaises sont référencées au
 * zéro hydrographique, sous lequel on ne descend pratiquement jamais.
 *
 * `meanTideRangeM` est le marnage au coefficient 70, d'où le point fixe.
 */
export function tidalRangeFor(spot: Spot, coefficient: number): number {
  return spot.meanTideRangeM * (0.45 + (0.55 * coefficient) / 70);
}

/**
 * Niveau moyen au-dessus du zéro des cartes.
 *
 * Posé juste assez haut pour que la basse mer de vive-eau extrême reste au-dessus
 * du zéro, avec une marge d'un demi-mètre.
 */
export function meanSeaLevelFor(spot: Spot): number {
  return tidalRangeFor(spot, 120) / 2 + 0.5;
}

/**
 * Décalage horaire de la pleine mer propre au spot — l'« établissement du port ».
 * Tiré du slug, donc stable d'un build à l'autre.
 */
export function spotTideLagHours(spot: Spot): number {
  return mulberry32(hashString(`${spot.slug}:tide`))() * M2_PERIOD_H;
}

/** Heures signées écoulées depuis la pleine mer la plus proche, dans [-6.21, +6.21]. */
export function hoursFromHighTide(spot: Spot, instant: Date): number {
  const elapsed = (instant.getTime() - TIDE_EPOCH_MS) / MS_PER_HOUR - spotTideLagHours(spot);
  const phase = ((elapsed % M2_PERIOD_H) + M2_PERIOD_H) % M2_PERIOD_H;
  return phase > M2_PERIOD_H / 2 ? phase - M2_PERIOD_H : phase;
}

/** État de la marée : montante, descendante, ou étale au voisinage du renverse. */
export function tideStateAt(spot: Spot, instant: Date): 'rising' | 'falling' | 'slack' {
  const h = hoursFromHighTide(spot, instant);
  const toTurn = Math.min(Math.abs(h), Math.abs(Math.abs(h) - M2_PERIOD_H / 2));
  if (toTurn < 0.3) return 'slack';
  return h < 0 ? 'rising' : 'falling';
}

/**
 * Suite de pleines et basses mers couvrant [from, to].
 *
 * Le modèle est une onde M2 pure : deux pleines mers et deux basses mers par
 * jour, à 12 h 25 d'intervalle, avec une amplitude proportionnelle au
 * coefficient et au marnage moyen du spot. Une vraie table de marée intègre
 * une dizaine d'ondes supplémentaires ; celle-ci ne prétend pas les remplacer.
 */
export function generateTideEvents(spot: Spot, from: Date, to: Date): TideEvent[] {
  const lag = spotTideLagHours(spot);
  const events: TideEvent[] = [];

  const firstIndex = Math.floor(
    ((from.getTime() - TIDE_EPOCH_MS) / MS_PER_HOUR - lag) / (M2_PERIOD_H / 2),
  );
  const lastIndex = Math.ceil(
    ((to.getTime() - TIDE_EPOCH_MS) / MS_PER_HOUR - lag) / (M2_PERIOD_H / 2),
  );

  for (let i = firstIndex; i <= lastIndex; i += 1) {
    const timeMs = TIDE_EPOCH_MS + (lag + (i * M2_PERIOD_H) / 2) * MS_PER_HOUR;
    if (timeMs < from.getTime() || timeMs > to.getTime()) continue;

    const time = new Date(timeMs);
    const coefficient = tideCoefficientFor(time);
    const isHigh = ((i % 2) + 2) % 2 === 0;
    const amplitude = tidalRangeFor(spot, coefficient) / 2;
    const meanLevel = meanSeaLevelFor(spot);

    events.push({
      time: time.toISOString(),
      type: isHigh ? 'high' : 'low',
      heightM: Math.round((meanLevel + (isHigh ? amplitude : -amplitude)) * 100) / 100,
      coefficient,
    });
  }

  return events;
}
