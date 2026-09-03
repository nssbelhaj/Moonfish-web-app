import { outingAlertEmail } from '@/lib/auth/email-template';
import { getSpotForecast, type ForecastSlot } from '@/lib/forecast';
import { sendMail } from '@/lib/mail/send';
import { contributions, spots } from '@/lib/providers';
import { absoluteUrl, SITE_URL, spotPath } from '@/lib/routes';
import { formatMeasure, tierForOrNull } from '@/lib/score-display';
import { formatDateTime } from '@/lib/time';
import { cardinal } from '@/lib/wind-direction';

/**
 * Les alertes de sortie : la veille, un courriel avec les conditions prévues.
 *
 * ─── Pourquoi 36 heures et pas 24 ─────────────────────────────────────────
 *
 * La tâche tourne une fois par jour, à une heure que l'on ne contrôle pas
 * finement. Avec un horizon de 24 h, une sortie prévue à 8 h et un cron à 9 h
 * la veille ne se verraient jamais : le message partirait le jour même, à 9 h,
 * une heure trop tard. 36 h garantit qu'un passage quotidien attrape toute
 * sortie au moins une fois AVANT la veille au soir.
 *
 * ─── Ce que la tâche garantit, et ce qu'elle ne garantit pas ──────────────
 *
 * Elle garantit qu'un courriel ne part qu'UNE fois par sortie : `notified_at`
 * est posé dès l'envoi accepté, et la lecture ne rend que les lignes où il
 * est vide. Relancer la tâche dix fois n'envoie rien de plus.
 *
 * Elle ne garantit pas la réception. SPF, DKIM et la réputation du domaine
 * sont hors de sa portée — c'est vrai des liens de connexion aussi, et c'est
 * dit dans la documentation plutôt qu'ici.
 */

export const ALERT_HORIZON_MS = 36 * 3_600_000;

export interface AlertRun {
  considered: number;
  sent: number;
  failed: number;
  /** Sorties hors de la fenêtre de prévision : on réessaiera au prochain passage. */
  deferred: number;
}

function slotAt(days: { slots: ForecastSlot[] }[], instantMs: number): ForecastSlot | null {
  for (const day of days) {
    for (const slot of day.slots) {
      if (new Date(slot.start).getTime() <= instantMs && new Date(slot.end).getTime() > instantMs) {
        return slot;
      }
    }
  }
  return null;
}

export async function sendOutingAlerts(now: Date = new Date()): Promise<AlertRun> {
  const run: AlertRun = { considered: 0, sent: 0, failed: 0, deferred: 0 };
  const pending = await contributions.pendingAlerts(now, ALERT_HORIZON_MS);
  run.considered = pending.length;

  for (const { outing, email } of pending) {
    const spot = await spots.findBySlug(outing.spotSlug);
    if (!spot) {
      // Un spot retiré du catalogue après programmation : on marque pour ne
      // pas boucler dessus chaque jour, et on ne dérange pas la personne avec
      // un courriel sur un lieu qui n'existe plus ici.
      await contributions.markNotified(outing.id, outing.userId, now);
      run.failed += 1;
      continue;
    }

    const forecast = await getSpotForecast(spot, now);
    const plannedMs = new Date(outing.plannedAt).getTime();
    const slot = slotAt(forecast.days, plannedMs);

    if (slot === null) {
      run.deferred += 1;
      continue;
    }

    const danger = slot.score.safety.level === 'danger';
    const score = slot.score.value;
    const tier = tierForOrNull(score);
    const belowThreshold = outing.minScore !== null && score !== null && score < outing.minScore;

    const facts: { label: string; value: string }[] = [];
    if (slot.tide) {
      const etat = { rising: 'montante', falling: 'descendante', slack: 'étale' }[slot.tide.state];
      facts.push({ label: 'Marée', value: `${etat}, coefficient ${slot.tide.coefficient}` });
    }
    if (slot.conditions) {
      const c = slot.conditions;
      facts.push({
        label: 'Vent',
        value: `${Math.round(c.windSpeedKmh)} km/h ${cardinal(c.windFromDeg)}${c.windGustKmh !== null ? `, rafales ${Math.round(c.windGustKmh)}` : ''}`,
      });
      facts.push({
        label: 'Houle',
        value: `${formatMeasure(c.swellHeightM, 'm', 1)}, période ${Math.round(c.swellPeriodS)} s`,
      });
    }
    facts.push({
      label: 'Lumière',
      value: { dawn: 'aube', day: 'jour', dusk: 'crépuscule', night: 'nuit' }[slot.lightPhase],
    });

    const message = outingAlertEmail({
      spotName: spot.name,
      spotUrl: absoluteUrl(`${spotPath(spot)}/prevision`),
      when: formatDateTime(new Date(outing.plannedAt), spot.timezone),
      danger,
      dangerMessage: danger ? (slot.score.safety.message ?? null) : null,
      score,
      tierLabel: danger ? 'Danger' : (tier?.label ?? 'indisponible'),
      belowThreshold,
      minScore: outing.minScore,
      facts,
      note: outing.note,
      accountUrl: absoluteUrl('/compte'),
      host: new URL(SITE_URL).host,
    });

    const result = await sendMail({ to: email, ...message });

    if (result.ok) {
      await contributions.markNotified(outing.id, outing.userId, now);
      run.sent += 1;
    } else {
      // Pas de marquage : on retentera au prochain passage. Le journal dit
      // pourquoi, sans l'adresse — elle n'a rien à faire dans un log.
      console.error(`[alertes] envoi impossible pour la sortie ${outing.id} : ${result.reason}`);
      run.failed += 1;
    }
  }

  return run;
}
