import { favoriteAlertEmail } from '@/lib/auth/email-template';
import { getSpotForecast, type ForecastDay, type ForecastSlot } from '@/lib/forecast';
import { sendMail } from '@/lib/mail/send';
import { contributions, spots } from '@/lib/providers';
import { absoluteUrl, SITE_URL, spotPath } from '@/lib/routes';
import { formatMeasure, tierForOrNull } from '@/lib/score-display';
import { formatDateTime, formatTime } from '@/lib/time';
import { cardinal } from '@/lib/wind-direction';

import { ALERT_HORIZON_MS } from './alerts';

/**
 * Les alertes sur les spots favoris : « Le Crotoy passe à 8,4 demain matin ».
 *
 * ─── Ce que c'est, et ce que ce n'est pas ─────────────────────────────────
 *
 * C'est la raison de revenir sans y penser : le site écrit quand un spot
 * qu'on suit devient bon. Ce n'est PAS une lettre d'information — il n'y a
 * rien à dire tant que le seuil n'est pas atteint, et rien n'est envoyé.
 *
 * ─── Une fois par créneau, jamais deux ────────────────────────────────────
 *
 * La tâche tourne chaque jour ; un créneau de demain matin reste dans la
 * fenêtre de 36 h à deux passages de suite. `alertedSlot` retient le début
 * du créneau annoncé : le même créneau ne repart pas, un créneau différent
 * — parce que la prévision a bougé, ou parce que c'est un autre jour — est
 * une information nouvelle, et part.
 *
 * Un créneau dangereux n'est JAMAIS annoncé comme bon, quel que soit son
 * score : la règle de sécurité précède le score, ici comme partout.
 */

export interface FavoriteAlertRun {
  considered: number;
  sent: number;
  failed: number;
  /** Favoris dont aucun créneau n'atteint le seuil, ou déjà annoncé. */
  silent: number;
}

/**
 * Le créneau à annoncer : le MEILLEUR de la fenêtre qui atteint le seuil,
 * praticable, à venir, et pas encore annoncé. `null` s'il n'y en a pas.
 *
 * Le meilleur plutôt que le premier : « 8,4 demain matin » vaut mieux que
 * « 7,1 ce soir » quand les deux passent le seuil — la personne choisira.
 */
export function creneauAAnnoncer(
  days: readonly ForecastDay[],
  now: Date,
  minScore: number,
  alertedSlot: string | null,
  horizonMs: number = ALERT_HORIZON_MS,
): ForecastSlot | null {
  const nowMs = now.getTime();
  const limite = nowMs + horizonMs;
  let meilleur: ForecastSlot | null = null;

  for (const day of days) {
    for (const slot of day.slots) {
      const start = new Date(slot.start).getTime();
      if (start <= nowMs || start > limite) continue;
      if (slot.score.value === null || slot.score.value < minScore) continue;
      if (slot.score.safety.level === 'danger') continue;
      if (meilleur === null || slot.score.value > (meilleur.score.value ?? -1)) meilleur = slot;
    }
  }

  if (meilleur === null) return null;
  if (alertedSlot !== null && new Date(alertedSlot).getTime() === new Date(meilleur.start).getTime()) {
    return null;
  }
  return meilleur;
}

export async function sendFavoriteAlerts(now: Date = new Date()): Promise<FavoriteAlertRun> {
  const run: FavoriteAlertRun = { considered: 0, sent: 0, failed: 0, silent: 0 };
  const aAlerter = await contributions.favoritesToAlert();
  run.considered = aAlerter.length;

  for (const { userId, email, favorite } of aAlerter) {
    const minScore = favorite.alertMinScore;
    if (minScore === null) continue;

    const spot = await spots.findBySlug(favorite.spotSlug);
    if (!spot) {
      run.silent += 1;
      continue;
    }

    const forecast = await getSpotForecast(spot, now);
    const slot = creneauAAnnoncer(forecast.days, now, minScore, favorite.alertedSlot);
    if (slot === null) {
      run.silent += 1;
      continue;
    }

    const facts: { label: string; value: string }[] = [];
    if (slot.tide) {
      const etat = { rising: 'montante', falling: 'descendante', slack: 'étale' }[slot.tide.state];
      facts.push({ label: 'Marée', value: `${etat}, coefficient ${slot.tide.coefficient}` });
    }
    if (slot.conditions) {
      const c = slot.conditions;
      facts.push({ label: 'Vent', value: `${Math.round(c.windSpeedKmh)} km/h ${cardinal(c.windFromDeg)}` });
      facts.push({ label: 'Houle', value: `${formatMeasure(c.swellHeightM, 'm', 1)}, période ${Math.round(c.swellPeriodS)} s` });
      if (c.waterTempC !== null) facts.push({ label: 'Eau', value: formatMeasure(c.waterTempC, '°C') });
    }
    facts.push({
      label: 'Lumière',
      value: { dawn: 'aube', day: 'jour', dusk: 'crépuscule', night: 'nuit' }[slot.lightPhase],
    });

    const tier = tierForOrNull(slot.score.value);
    const message = favoriteAlertEmail({
      spotName: spot.name,
      spotUrl: absoluteUrl(`${spotPath(spot)}/prevision`),
      when: `${formatDateTime(new Date(slot.start), spot.timezone)} – ${formatTime(new Date(slot.end), spot.timezone)}`,
      score: slot.score.value ?? 0,
      tierLabel: tier?.label ?? 'Bon',
      minScore,
      facts,
      accountUrl: absoluteUrl('/compte#espace-sorties'),
      host: new URL(SITE_URL).host,
    });

    const result = await sendMail({ to: email, ...message });

    if (result.ok) {
      await contributions.markFavoriteAlerted(userId, favorite.spotSlug, new Date(slot.start));
      run.sent += 1;
    } else {
      console.error(`[alertes favoris] envoi impossible pour ${favorite.spotSlug} : ${result.reason}`);
      run.failed += 1;
    }
  }

  return run;
}
