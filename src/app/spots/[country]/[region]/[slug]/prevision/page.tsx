import type { Metadata } from 'next';

import { DemoDataNotice } from '@/components/data/DemoDataNotice';
import { SpotTabs } from '@/components/spot/SpotTabs';
import { SlotRow } from '@/components/v3/SlotRow';
import { TideActivityChart } from '@/components/v3/TideActivityChart';
import { WaterValue } from '@/components/v3/WaterValue';
import { SLOTS_PER_DAY, sourceList } from '@/lib/forecast';
import { tidalRangeOf } from '@/lib/forecast/tide-curve';
import { absoluteUrl, spotPath } from '@/lib/routes';
import { formatMeasure, formatScore, tierForOrNull } from '@/lib/score-display';
import { formatDayLong, formatDayNumber, formatTime, formatWeekdayShort } from '@/lib/time';
import { findSpot, resolveSpot, type RouteParams } from '../spot-page-data';

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}): Promise<Metadata> {
  const spot = await findSpot(params);
  if (!spot) return { title: 'Spot introuvable' };

  return {
    title: `Prévision 7 jours à ${spot.name}`,
    description: `Les créneaux de pêche à ${spot.name} sur sept jours, jour par jour : marée, activité, vent et houle, par tranches de deux heures.`,
    alternates: { canonical: absoluteUrl(`${spotPath(spot)}/prevision`) },
  };
}

export default async function SpotForecastPage({ params }: { params: Promise<RouteParams> }) {
  const { spot, forecast, now } = await resolveSpot(params);
  const nowMs = now.getTime();

  return (
    <>
      <div className="mx-auto w-full max-w-shell px-4 pt-6 md:px-8">
        <SpotTabs basePath={spotPath(spot)} active="prevision" />
        <div className="mt-6">
          <DemoDataNotice sources={sourceList(forecast.sources)} />
        </div>
      </div>

      <div className="mx-auto w-full max-w-shell px-4 py-8 md:px-8 md:py-12">
        {/*
          La règle graduée des jours (D1) sert ici d'ancrage : chaque graduation
          renvoie à la section du jour, plus bas. Ce sont des ancres et non un
          état client — la page reste entièrement rendue au serveur, chaque jour
          reste atteignable sans JavaScript, et le lien est partageable.
        */}
        <nav aria-label="Aller à un jour" className="surface p-3">
          <ul className="flex items-end gap-0 overflow-x-auto">
            {forecast.days.map((day) => {
              const date = new Date(day.date);
              const coefficient = day.tideEvents[0]?.coefficient ?? null;
              const tier = tierForOrNull(day.best?.score.value ?? null);
              return (
                <li key={day.date} className="min-w-[46px] flex-1">
                  <a
                    href={`#jour-${day.date.slice(0, 10)}`}
                    className="flex min-h-tap flex-col items-center justify-center gap-[5px] rounded-[8px] py-[6px] tappable"
                  >
                    <span className="text-[11px] text-fg-muted">
                      {formatWeekdayShort(date, spot.timezone)}
                    </span>
                    <span className="text-[15px] font-semibold nums" data-numeric="">
                      {formatDayNumber(date, spot.timezone)}
                    </span>
                    <WaterValue className="nums text-[12px]">{coefficient ?? '—'}</WaterValue>
                    <span
                      className="h-2 w-2 rounded-full"
                      aria-hidden="true"
                      style={{
                        backgroundColor: tier?.colorVar ?? 'var(--card)',
                        boxShadow: tier ? undefined : '0 0 0 1px var(--edge)',
                      }}
                    />
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>

        {forecast.days.map((day, index) => {
          const range = tidalRangeOf(day.tideEvents);
          const coefficient = day.tideEvents[0]?.coefficient ?? null;
          const dayEnd = new Date(day.date).getTime() + 24 * 3_600_000;
          const past = dayEnd <= nowMs;

          return (
            <section
              key={day.date}
              id={`jour-${day.date.slice(0, 10)}`}
              aria-labelledby={`titre-${day.date.slice(0, 10)}`}
              className={`mt-10 scroll-mt-6 ${past ? 'opacity-70' : ''}`}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h2
                  id={`titre-${day.date.slice(0, 10)}`}
                  className="font-serif text-h2 font-semibold first-letter:uppercase"
                >
                  {formatDayLong(new Date(day.date), spot.timezone)}
                  {index === 0 && <span className="text-fg-muted"> · aujourd’hui</span>}
                </h2>
                <p className="text-meta text-fg-muted">
                  {day.best ? (
                    <>
                      meilleure fenêtre{' '}
                      <span className="nums" data-numeric="">
                        {formatTime(new Date(day.best.start), spot.timezone)}
                      </span>{' '}
                      · {formatScore(day.best.score.value)}/10
                    </>
                  ) : (
                    'aucune fenêtre praticable'
                  )}
                </p>
              </div>

              <div className="mt-4 xl:grid xl:grid-cols-[1fr_360px] xl:gap-6">
                <TideActivityChart
                  day={day}
                  tideEvents={forecast.tideEvents}
                  timeZone={spot.timezone}
                  now={forecast.generatedAt}
                  coefficient={coefficient}
                />

                <div className="surface mt-4 p-[14px] xl:mt-0">
                  <h3 className="card-title">Les {SLOTS_PER_DAY} créneaux</h3>
                  <div className="mt-2">
                    {day.slots.map((slot, slotIndex) => (
                      <SlotRow
                        key={slot.start}
                        slot={slot}
                        timeZone={spot.timezone}
                        active={
                          new Date(slot.start).getTime() <= nowMs &&
                          new Date(slot.end).getTime() > nowMs
                        }
                        last={slotIndex === day.slots.length - 1}
                      />
                    ))}
                  </div>

                  <p className="card-source mt-2">
                    Coefficient{' '}
                    <WaterValue className="nums">{coefficient ?? '—'}</WaterValue>
                    {range !== null && (
                      <>
                        {' · marnage '}
                        <WaterValue className="nums">{formatMeasure(range, 'm', 2)}</WaterValue>
                      </>
                    )}
                    {day.sunrise && day.sunset && (
                      <>
                        {' · lever '}
                        <span className="nums">
                          {formatTime(new Date(day.sunrise), spot.timezone)}
                        </span>
                        {', coucher '}
                        <span className="nums">
                          {formatTime(new Date(day.sunset), spot.timezone)}
                        </span>
                      </>
                    )}
                  </p>
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
