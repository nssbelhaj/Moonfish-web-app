/**
 * Statistique des hauteurs de vagues, loi de Rayleigh.
 *
 * Une mer n'a pas UNE hauteur : elle a une distribution. Annoncer « houle
 * 0,6 m » et s'arrêter là laisse croire que les vagues font 0,6 m, alors que
 * la hauteur significative est déjà la moyenne du plus grand TIERS d'entre
 * elles — et qu'une vague sur trois mille en fera le double.
 *
 * Sous l'hypothèse de Rayleigh, classique en océanographie pour une mer du
 * vent pleinement développée, tout se déduit de la seule hauteur significative :
 *
 *   P(H > α·Hs) = exp(−2α²)
 *
 * Le contrôle est immédiat : α = 1 donne 13,5 % — environ une vague sur sept,
 * ce qu'annoncent les services de prévision ; α = 2 donne une vague sur 2 985,
 * soit trois par jour à neuf secondes de période. Ces deux nombres sont ceux
 * qu'on lit partout, et ils tombent juste.
 *
 * Ce module ne mesure rien : il DÉDUIT, et l'interface doit le dire.
 */

/** Fraction des vagues dépassant α fois la hauteur significative. */
export function exceedanceFraction(alpha: number): number {
  if (alpha <= 0) return 1;
  return Math.exp(-2 * alpha * alpha);
}

/**
 * Hauteur la plus fréquente : le mode de la distribution, soit la moitié de la
 * hauteur significative. C'est ce que l'œil voit la plupart du temps.
 */
export function mostFrequentHeight(significantM: number): number {
  return Math.max(0, significantM) / 2;
}

/** Nombre de vagues sur une durée, d'après la période pic. */
export function waveCount(periodS: number, hours: number): number {
  if (periodS <= 0 || hours <= 0) return 0;
  return (hours * 3600) / periodS;
}

/**
 * Hauteur maximale attendue sur une durée donnée.
 *
 * H_max ≈ Hs · √(ln N / 2), où N est le nombre de vagues. Ce n'est pas un
 * plafond : c'est l'espérance du maximum. Une vague plus grosse reste possible,
 * et c'est exactement pour ça que la valeur mérite d'être affichée plutôt que
 * laissée sous la seule hauteur significative.
 */
export function maxExpectedHeight(
  significantM: number,
  periodS: number,
  hours = 24,
): number | null {
  const n = waveCount(periodS, hours);
  if (n < Math.E || significantM <= 0) return null;
  return significantM * Math.sqrt(Math.log(n) / 2);
}

export interface WaveHeights {
  /** Ce que l'œil voit la plupart du temps. */
  frequentM: number;
  /** La hauteur annoncée par les modèles. */
  significantM: number;
  /** L'espérance du maximum sur la durée retenue. */
  maxM: number | null;
  /** Combien de vagues dépassent la significative, en pourcentage. */
  exceedingSignificantPct: number;
  /** Une vague sur combien atteint le double de la significative. */
  oneInForDouble: number;
}

export function waveHeights(significantM: number, periodS: number): WaveHeights {
  return {
    frequentM: mostFrequentHeight(significantM),
    significantM: Math.max(0, significantM),
    maxM: maxExpectedHeight(significantM, periodS),
    exceedingSignificantPct: Math.round(exceedanceFraction(1) * 100),
    oneInForDouble: Math.round(1 / exceedanceFraction(2)),
  };
}

/** Rose des vents à seize secteurs, pour une direction en degrés. */
const COMPASS = [
  'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
  'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO',
] as const;

export function compassPoint(deg: number): string {
  const normalized = ((deg % 360) + 360) % 360;
  return COMPASS[Math.round(normalized / 22.5) % 16] as string;
}
