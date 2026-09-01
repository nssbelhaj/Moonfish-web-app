'use client';

import Link from 'next/link';
import type { ForecastDay } from '@/lib/forecast';
import { formatDayNumber, formatWeekdayShort } from '@/lib/time';

/**
 * Sélecteur de jour — une RÈGLE GRADUÉE, pas une rangée de pastilles (D1).
 *
 * Chaque graduation porte la date ET le coefficient : c'est le coefficient qui
 * décide vraiment de la sortie, et le masquer obligerait à ouvrir chaque jour
 * pour le lire. Le repère plein sous la date marque le jour actif.
 *
 * Le dernier jour visible est à demi-largeur et à demi-opacité : ce n'est pas
 * une décoration, c'est ce qui dit qu'on peut faire défiler. Une rangée qui
 * s'arrête net au bord de l'écran se lit comme une liste complète.
 */
export function DayRuler({
  days,
  activeIndex,
  hrefFor,
  timeZone,
}: {
  days: readonly ForecastDay[];
  activeIndex: number;
  hrefFor: (index: number) => string;
  timeZone: string;
}) {
  return (
    <div className="surface p-3">
      <div className="flex items-end gap-0 overflow-x-auto">
        {days.map((day, index) => {
          const active = index === activeIndex;
          const coefficient = day.tideEvents[0]?.coefficient ?? null;
          const date = new Date(day.date);

          return (
            <Link
              key={day.date}
              href={hrefFor(index)}
              aria-current={active ? 'date' : undefined}
              className={[
                'flex min-w-[46px] flex-1 flex-col items-center gap-[5px] rounded-[8px] py-[6px]',
                'min-h-tap justify-center tappable',
                active ? 'bg-surface-2' : '',
              ].join(' ')}
            >
              <span className={`text-[11px] ${active ? 'text-fg' : 'text-fg-muted'}`}>
                {formatWeekdayShort(date, timeZone)}
              </span>
              <span className={`text-[15px] nums ${active ? 'font-bold' : 'font-semibold'}`} data-numeric="">
                {formatDayNumber(date, timeZone)}
              </span>
              <span className="water-value text-[12px] nums" data-numeric="">
                {coefficient ?? '—'}
              </span>
              <span
                className="h-2 w-2 rounded-full"
                aria-hidden="true"
                style={
                  active
                    ? { backgroundColor: 'var(--accent)' }
                    : { backgroundColor: 'var(--card)', boxShadow: '0 0 0 1px var(--edge)' }
                }
              />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
