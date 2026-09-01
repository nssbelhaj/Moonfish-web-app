import Link from 'next/link';
import type { ForecastDay, ForecastSlot } from '@/lib/forecast';
import { UNAVAILABLE_COLOR_VAR, formatScore, tierForOrNull } from '@/lib/score-display';
import { formatDayShort, formatTime } from '@/lib/time';

/** Au-delà de J+2, la profondeur temporelle passe derrière le mur Pro (handoff §5). */
export const FREE_DAYS = 3;

function slotColor(slot: ForecastSlot, isPast: boolean): string {
  // Un créneau écoulé n'est pas un mauvais créneau : il n'a plus de créneau du
  // tout. Il prend `night`, une non-couleur, pour ne pas être lu comme un échec
  // (handoff §5).
  if (isPast) return 'var(--night)';
  if (slot.score.safety.level === 'danger') return 'var(--score-1)';
  return tierForOrNull(slot.score.value)?.colorVar ?? UNAVAILABLE_COLOR_VAR;
}

/**
 * Les 7 jours de créneaux, 8 colonnes de 3 h par jour.
 *
 * Mobile : défilement horizontal avec accroche par jour. À partir de 768 px,
 * les 7 jours tiennent en entier. Aucune donnée n'apparaît sur desktop qui ne
 * soit pas atteignable sur mobile (handoff §4).
 */
export function TimeWindowBar({
  days,
  timeZone,
  now,
}: {
  days: readonly ForecastDay[];
  timeZone: string;
  /** Instant de référence, ISO. */
  now: string;
}) {
  const nowMs = new Date(now).getTime();

  return (
    <div>
      <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 md:snap-none">
        {days.map((day, dayIndex) => {
          const locked = dayIndex >= FREE_DAYS;

          return (
            <div
              key={day.date}
              className="min-w-[46%] flex-1 snap-start sm:min-w-[30%] md:min-w-0"
            >
              <p className="text-meta text-fg-faint nums">
                {formatDayShort(new Date(day.date), timeZone)}
              </p>

              <div className="relative mt-2">
                <ul
                  className={locked ? 'pointer-events-none select-none blur-[5px]' : undefined}
                  aria-hidden={locked || undefined}
                >
                  {day.slots.map((slot) => {
                    const isPast = new Date(slot.end).getTime() <= nowMs;
                    const tier = tierForOrNull(slot.score.value);

                    return (
                      <li key={slot.start} className="flex items-center gap-2 py-[3px]">
                        <span className="w-9 shrink-0 text-meta text-fg-faint nums" data-numeric="">
                          {formatTime(new Date(slot.start), timeZone)}
                        </span>
                        <span
                          className="h-4 rounded-[1px]"
                          style={{
                            backgroundColor: slotColor(slot, isPast),
                            // Score absent : la barre reste au minimum visible,
                            // sans jamais suggérer une longueur donc une valeur.
                            width: `${Math.max(6, (slot.score.value ?? 0) * 10)}%`,
                          }}
                        />
                        <span className="text-meta text-fg-faint nums" data-numeric="">
                          {isPast ? '—' : formatScore(slot.score.value)}
                        </span>
                        <span className="sr-only">
                          {isPast
                            ? 'créneau passé'
                            : tier
                              ? `${tier.label}, ${formatScore(slot.score.value)} sur 10`
                              : 'score indisponible'}
                        </span>
                      </li>
                    );
                  })}
                </ul>

                {locked && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-meta text-fg-faint nums text-fg-muted">
                      Pro
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-meta nums text-fg-muted">
        Les trois premiers jours sont gratuits. Les créneaux de J+3 à J+6 sont réservés au plan
        Pro —{' '}
        <Link href="/pricing" className="underline decoration-dotted underline-offset-4">
          voir les plans
        </Link>
        .
      </p>
    </div>
  );
}
