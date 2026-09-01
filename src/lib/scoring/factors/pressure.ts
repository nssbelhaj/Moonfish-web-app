import { clamp, fr, ramp, round1, trapezoid } from '../math';
import type { AvailableFactorResult, FactorResult, PressureInput } from '../types';
import { FACTOR_WEIGHTS, unavailableFactor } from '../types';

/**
 * Pression, et surtout sa VARIATION.
 *
 * La valeur absolue ne dit presque rien : 1013 hPa n'est ni bon ni mauvais. Ce
 * que les pêcheurs observent depuis toujours, et que la littérature halieutique
 * recoupe, c'est la TENDANCE — une pression qui baisse à l'approche d'une
 * perturbation précède souvent une phase d'activité, une pression qui remonte
 * franchement derrière un front la referme.
 *
 * Le facteur est donc bâti sur la variation sur trois heures, la valeur absolue
 * ne servant qu'aux extrêmes où elle redevient significative.
 *
 * Il pèse 9 % : réel, mais secondaire devant la marée. Lui donner davantage
 * reviendrait à prétendre une précision que ni la donnée ni la littérature ne
 * soutiennent.
 */

/** Baisse en hPa sur 3 h à partir de laquelle on parle de chute franche. */
export const SHARP_FALL_HPA = 3;
/** Hausse en hPa sur 3 h à partir de laquelle la fenêtre se referme. */
export const SHARP_RISE_HPA = 2.5;

/**
 * Facteur de tendance, 0–1.
 *
 * Optimum sur une baisse douce à modérée (−0,5 à −2,5 hPa/3 h). Une chute
 * brutale n'est pas meilleure : elle annonce du gros temps, et la sécurité
 * reprend la main de toute façon. Une pression stable reste correcte — c'est le
 * cas le plus fréquent, il ne doit pas être pénalisé.
 */
export function trendFactor(deltaHpa: number): number {
  // Baisse douce : la fenêtre porteuse.
  const falling = trapezoid(deltaHpa, -4.5, -2.5, -0.5, 0.6);
  // Stable ou en légère hausse : correct, sans plus.
  const steady = 0.72 * trapezoid(deltaHpa, -0.8, -0.2, 0.8, 2);
  // Hausse franche derrière un front : le moins favorable.
  const rising = 0.34 * ramp(deltaHpa, SHARP_RISE_HPA, 5, 1, 0.4);

  return clamp(Math.max(falling, steady, deltaHpa >= SHARP_RISE_HPA ? rising : 0), 0.3, 1);
}

/** Une pression extrême module légèrement, sans jamais dominer la tendance. */
export function levelFactor(hPa: number): number {
  if (hPa < 995) return 0.88;
  if (hPa > 1030) return 0.9;
  return 1;
}

export function describeTrend(deltaHpa: number): string {
  if (deltaHpa <= -SHARP_FALL_HPA) return 'chute rapide';
  if (deltaHpa <= -0.8) return 'en baisse';
  if (deltaHpa >= SHARP_RISE_HPA) return 'hausse rapide';
  if (deltaHpa >= 0.8) return 'en hausse';
  return 'stable';
}

export function scorePressure(input: PressureInput): AvailableFactorResult;
export function scorePressure(input: PressureInput | null): FactorResult;
export function scorePressure(input: PressureInput | null): FactorResult {
  if (input === null) return unavailableFactor('pressure');

  // Sans tendance, on ne juge pas : une pression seule n'est pas une
  // information exploitable, et l'inventer serait pire que de l'admettre.
  if (input.trend3hHpa === null) {
    return {
      score: 5,
      weight: FACTOR_WEIGHTS.pressure,
      nominalWeight: FACTOR_WEIGHTS.pressure,
      note: `${Math.round(input.hPa)} hPa · tendance inconnue, facteur neutralisé`,
    };
  }

  const trend = trendFactor(input.trend3hHpa);
  const level = levelFactor(input.hPa);
  const delta = input.trend3hHpa;

  const label = describeTrend(delta);
  const signed = `${delta >= 0 ? '+' : '−'}${fr(Math.abs(delta))} hPa/3 h`;

  const note =
    delta <= -SHARP_FALL_HPA
      ? `${Math.round(input.hPa)} hPa, ${label} (${signed}) — dégradation en approche, la fenêtre se referme vite`
      : delta <= -0.8
        ? `${Math.round(input.hPa)} hPa, ${label} (${signed}) — la baisse précède souvent une phase active`
        : delta >= SHARP_RISE_HPA
          ? `${Math.round(input.hPa)} hPa, ${label} (${signed}) — retour au calme, activité en retrait`
          : `${Math.round(input.hPa)} hPa, ${label} (${signed})`;

  return {
    score: round1(clamp(10 * trend * level, 0, 10)),
    weight: FACTOR_WEIGHTS.pressure,
    nominalWeight: FACTOR_WEIGHTS.pressure,
    note,
  };
}
