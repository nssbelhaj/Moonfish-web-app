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
 *
 * Sources manquantes : l'ABSENCE DE DONNÉE N'EST PAS UNE PREUVE DE SÉCURITÉ.
 * Sans la houle ou sans le vent, les seuils de 2,5 m et 50 km/h ne peuvent pas
 * être vérifiés ; le verdict ne peut donc pas être « ok », il descend au mieux
 * à « prudence » et le dit. Renvoyer « ok » ici reviendrait à certifier une mer
 * praticable qu'on n'a pas regardée.
 */
export function evaluateSafety(input: ScoreInput): SafetyVerdict {
  const swell = input.swell === null ? null : input.swell.heightM;
  const wind = input.wind === null ? null : input.wind.speedKmh;

  const swellDanger = swell !== null && swell > SWELL_DANGER_M;
  const windDanger = wind !== null && wind > WIND_DANGER_KMH;

  if (swellDanger || windDanger) {
    const causes: string[] = [];
    if (swellDanger && swell !== null) causes.push(`houle de ${fr(swell)} m`);
    if (windDanger && wind !== null) causes.push(`vent de ${Math.round(wind)} km/h`);
    return {
      level: 'danger',
      message: `Conditions dangereuses depuis le bord : ${causes.join(' et ')}. Risque de vague de bord et de perte d’appui sur l’estran. Ne pêchez pas depuis les roches, les digues ou les platiers, quel que soit le score affiché.`,
    };
  }

  const swellCaution = swell !== null && swell >= SWELL_CAUTION_M;
  const windCaution = wind !== null && wind >= WIND_BAD_KMH - 5;

  const unverified: string[] = [];
  if (swell === null) unverified.push('la houle');
  if (wind === null) unverified.push('le vent');

  if (swellCaution || windCaution || unverified.length > 0) {
    const causes: string[] = [];
    if (swellCaution && swell !== null) causes.push(`houle de ${fr(swell)} m`);
    if (windCaution && wind !== null) causes.push(`vent de ${Math.round(wind)} km/h`);

    if (unverified.length > 0) {
      const subjects = unverified.join(' ni ');
      const observed = causes.length > 0 ? `${causes.join(' et ')}, et ` : '';
      return {
        level: 'prudence',
        message: `Vigilance : ${observed}${subjects} ${unverified.length > 1 ? 'ne sont pas disponibles' : "n’est pas disponible"} pour ce créneau. Les seuils de sécurité (${fr(SWELL_DANGER_M)} m de houle, ${WIND_DANGER_KMH} km/h de vent) n’ont pas pu être vérifiés : l’absence de donnée ne veut pas dire que la mer est praticable. Vérifiez sur place avant de descendre.`,
      };
    }

    return {
      level: 'prudence',
      message: `Vigilance : ${causes.join(' et ')}. Restez en retrait de la laisse de mer, pêchez accompagné et gardez un œil sur la montante.`,
    };
  }

  return { level: 'ok' };
}
