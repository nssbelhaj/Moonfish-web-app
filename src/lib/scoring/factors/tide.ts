import { clamp, ramp, round1, trapezoid } from '../math';
import type { FactorResult, TideInput } from '../types';
import { FACTOR_WEIGHTS } from '../types';

/** Demi-période moyenne d'une marée semi-diurne, en heures. */
const HALF_CYCLE_H = 6.2;

/** Mouvement d'eau résiduel hors des fenêtres portantes. */
const RESIDUAL_MOVEMENT = 0.12;

/**
 * Facteur de position dans le cycle.
 *
 * Deux fenêtres portantes, conformément à la spec :
 *  - de 2 h avant à 1 h après la pleine mer ;
 *  - la descendante établie, quand le courant est installé (env. +2 h à +4 h 30).
 * L'étale de basse mer, où plus rien ne circule, est franchement pénalisée.
 */
export function tidePositionFactor(hoursFromHighTide: number): number {
  const h = clamp(hoursFromHighTide, -HALF_CYCLE_H, HALF_CYCLE_H);

  const aroundHigh = trapezoid(h, -3, -2, 1, 2);
  const establishedEbb = 0.85 * trapezoid(h, 1.5, 2.2, 4.4, 5.2);
  // La montante établie travaille aussi, mais moins que les deux fenêtres ci-dessus.
  const establishedFlood = 0.6 * trapezoid(h, -5.2, -4.4, -3, -2.4);

  const positional = Math.max(aroundHigh, establishedEbb, establishedFlood);

  // Plancher continu : hors fenêtre, il reste toujours un peu d'eau qui bouge.
  // Il évite surtout une discontinuité entre la fin de la descendante établie
  // et l'étale de basse mer, où le facteur retombait à zéro exact — soit plus
  // bas que l'étale elle-même, ce qui n'a aucun sens physique.
  return Math.max(positional, RESIDUAL_MOVEMENT);
}

/**
 * Pénalité d'étale : au renverse exact, la masse d'eau ne circule plus.
 * Elle creuse le sommet de la fenêtre de pleine mer sans l'annuler.
 */
export function slackPenalty(hoursFromHighTide: number, isSlack: boolean): number {
  const distanceToTurn = Math.min(
    Math.abs(hoursFromHighTide),
    Math.abs(Math.abs(hoursFromHighTide) - HALF_CYCLE_H),
  );
  const geometric = distanceToTurn < 0.4 ? ramp(distanceToTurn, 0, 0.4, 0.62, 1) : 1;
  // Un état `slack` explicitement remonté par le fournisseur prime sur la géométrie.
  return isSlack ? Math.min(geometric, 0.62) : geometric;
}

/**
 * Modulation par le coefficient.
 * 70–95 optimal · 45–70 correct · > 110 courant trop fort, donc pénalisé ·
 * < 45 marée trop molle pour brasser quoi que ce soit.
 */
export function coefficientFactor(coefficient: number): number {
  const c = clamp(coefficient, 20, 120);
  if (c < 45) return ramp(c, 20, 45, 0.5, 0.72);
  if (c < 70) return ramp(c, 45, 70, 0.72, 1);
  if (c <= 95) return 1;
  if (c <= 110) return ramp(c, 95, 110, 1, 0.82);
  return ramp(c, 110, 120, 0.82, 0.5);
}

function buildNote(input: TideInput, positional: number, slack: number): string {
  const h = input.hoursFromHighTide;
  const when =
    h >= -2 && h <= 1
      ? 'fenêtre de pleine mer'
      : h > 1 && h <= 4.6
        ? 'descendante établie'
        : h < -2 && h >= -5.2
          ? 'montante établie'
          : 'abords de la basse mer';

  const parts: string[] = [`${when} (${h >= 0 ? '+' : ''}${round1(h)} h / PM)`];
  if (slack < 0.9) parts.push('étale, le courant ne porte plus');

  const c = Math.round(input.coefficient);
  if (c > 110) parts.push(`coefficient ${c}, courant trop fort`);
  else if (c < 45) parts.push(`coefficient ${c}, marée trop molle`);
  else if (c >= 70 && c <= 95) parts.push(`coefficient ${c}, dans la zone utile`);
  else parts.push(`coefficient ${c}, correct`);

  if (positional < 0.2) parts.push('peu de mouvement d’eau');

  return parts.join(' · ');
}

export function scoreTide(input: TideInput): FactorResult {
  const positional = tidePositionFactor(input.hoursFromHighTide);
  const slack = slackPenalty(input.hoursFromHighTide, input.state === 'slack');
  const coef = coefficientFactor(input.coefficient);

  return {
    score: round1(clamp(10 * positional * slack * coef, 0, 10)),
    weight: FACTOR_WEIGHTS.tide,
    note: buildNote(input, positional, slack),
  };
}
