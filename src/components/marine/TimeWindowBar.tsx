import type { ForecastDay, ForecastSlot } from '@/lib/forecast';
import { UNAVAILABLE_COLOR_VAR, formatScore, tierForOrNull } from '@/lib/score-display';
import { formatDayShort, formatTime } from '@/lib/time';

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
        {days.map((day) => {
          return (
            <div
              key={day.date}
              className="min-w-[46%] flex-1 snap-start sm:min-w-[30%] md:min-w-0"
            >
              <p className="text-meta text-fg-faint nums">
                {formatDayShort(new Date(day.date), timeZone)}
              </p>

              <div className="relative mt-2">
                <ul>
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
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}
