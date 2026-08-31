import { fr } from './math';
import { WIND_BAD_KMH, WIND_DANGER_KMH } from './factors/wind';
import { SWELL_CAUTION_M, SWELL_DANGER_M } from './factors/swell';
import type { SafetyLevel, ScoreInput } from './types';

export interface SafetyVerdict {
  level: SafetyLevel;
  message?: string;
}

/**
 * Règle non négociable (spec + handoff §3).
 *
 * Elle est évaluée sur le créneau affiché, indépendamment du score : un créneau
 * peut être excellent au sens halieutique et dangereux au sens humain. Le score
 * ne doit jamais pouvoir annuler cette évaluation, c'est pourquoi elle vit dans
 * son propre module et n'est pas dérivée du `breakdown`.
 *
 * Seuils de vigilance retenus au-delà du handoff, qui ne cadrait que la houle :
 * 35–50 km/h de vent déclenche la variante ambre, par symétrie avec 2,0–2,5 m.
 */
export function evaluateSafety(input: ScoreInput): SafetyVerdict {
  const swell = input.swell.heightM;
  const wind = input.wind.speedKmh;

  const swellDanger = swell > SWELL_DANGER_M;
  const windDanger = wind > WIND_DANGER_KMH;

  if (swellDanger || windDanger) {
    const causes: string[] = [];
    if (swellDanger) causes.push(`houle de ${fr(swell)} m`);
    if (windDanger) causes.push(`vent de ${Math.round(wind)} km/h`);
    return {
      level: 'danger',
      message: `Conditions dangereuses depuis le bord : ${causes.join(' et ')}. Risque de vague de bord et de perte d'appui sur l'estran. Ne pêchez pas depuis les roches, les digues ou les platiers, quel que soit le score affiché.`,
    };
  }

  const swellCaution = swell >= SWELL_CAUTION_M;
  const windCaution = wind >= WIND_BAD_KMH - 5;

  if (swellCaution || windCaution) {
    const causes: string[] = [];
    if (swellCaution) causes.push(`houle de ${fr(swell)} m`);
    if (windCaution) causes.push(`vent de ${Math.round(wind)} km/h`);
    return {
      level: 'prudence',
      message: `Vigilance : ${causes.join(' et ')}. Restez en retrait de la laisse de mer, pêchez accompagné et gardez un œil sur la montante.`,
    };
  }

  return { level: 'ok' };
}
