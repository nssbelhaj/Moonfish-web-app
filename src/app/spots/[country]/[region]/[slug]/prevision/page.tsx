import type { Metadata } from 'next';

import { TimeWindowBar } from '@/components/marine/TimeWindowBar';
import { ScoreBadge } from '@/components/score/ScoreBadge';
import { DemoDataNotice } from '@/components/data/DemoDataNotice';
import { SpotTabs } from '@/components/spot/SpotTabs';
import { Card } from '@/components/ui/Card';
import { favourableSlots } from '@/lib/forecast';
import { absoluteUrl, spotPath } from '@/lib/routes';
import { formatDayLong, formatTime } from '@/lib/time';
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
    description: `Les meilleurs créneaux de pêche à ${spot.name} sur sept jours, découpés par tranches de trois heures : marée, vent, houle et lumière notés heure par heure.`,
    alternates: { canonical: absoluteUrl(`${spotPath(spot)}/prevision`) },
  };
}

export default async function SpotForecastPage({ params }: { params: Promise<RouteParams> }) {
  const { spot, forecast, now } = await resolveSpot(params);

  const upcoming = forecast.days
    .flatMap((day) => day.slots)
    .filter((slot) => new Date(slot.end).getTime() > now.getTime())
    .filter((slot) => slot.score.safety.level !== 'danger');

  const bestSlots = [...upcoming]
    .filter((slot) => slot.score.value !== null)
    .sort((a, b) => (b.score.value ?? 0) - (a.score.value ?? 0))
    .slice(0, 5);

  return (
    <>
      <div className="mx-auto w-full max-w-shell px-4 pt-6 md:px-8">
        <SpotTabs basePath={spotPath(spot)} active="prevision" />

        <div className="mt-6">
          <DemoDataNotice sources={Object.values(forecast.sources)} />
        </div>
      </div>

      <div className="mx-auto w-full max-w-shell px-4 py-8 md:px-8 md:py-12">
        <section aria-labelledby="fenetres">
          <h2 id="fenetres" className="text-val-sm font-600">
            Les meilleurs créneaux des 7 jours
          </h2>
          <p className="mt-2 max-w-prose text-body text-fg-muted">
            Classés par score, hors conditions dangereuses. Un créneau dangereux n’est jamais
            recommandé, quel que soit son score halieutique.
          </p>

          <ul className="mt-6 divide-y divide-edge">
            {bestSlots.map((slot) => (
              <li key={slot.start} className="py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
                  <p className="text-meta nums text-fg" data-numeric="">
                    {formatDayLong(new Date(slot.start), spot.timezone)} ·{' '}
                    {formatTime(new Date(slot.start), spot.timezone)}–
                    {formatTime(new Date(slot.end), spot.timezone)}
                  </p>
                  <ScoreBadge value={slot.score.value} />
                </div>
                <p className="mt-2 text-meta nums text-fg-muted">
                  {slot.score.reasons[1] ?? slot.score.reasons[0]}
                </p>
              </li>
            ))}
            {bestSlots.length === 0 && (
              <li className="py-4 text-body text-fg-muted">
                Aucun créneau praticable sur la période.
              </li>
            )}
          </ul>
        </section>

        <section aria-labelledby="jours" className="mt-12">
          <h2 id="jours" className="text-val-sm font-600">
            Jour par jour
          </h2>
          <p className="mt-2 max-w-prose text-body text-fg-muted">
            Le meilleur créneau de chaque journée, et le nombre de tranches favorables qu’elle
            contient.
          </p>

          <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {forecast.days.map((day) => {
              const favourable = favourableSlots(day.slots);
              return (
                <li key={day.date}>
                  <Card className="h-full p-4">
                    <p className="text-meta text-fg-faint nums">
                      {formatDayLong(new Date(day.date), spot.timezone)}
                    </p>
                    <div className="mt-3">
                      <ScoreBadge
                        value={day.best?.score.value ?? null}
                        muted={day.best === null}
                      />
                    </div>
                    <p className="mt-3 text-meta nums text-fg-muted" data-numeric="">
                      {day.best
                        ? `Meilleure fenêtre ${formatTime(new Date(day.best.start), spot.timezone)}–${formatTime(new Date(day.best.end), spot.timezone)}`
                        : 'Aucune fenêtre praticable'}
                    </p>
                    <p className="mt-1 text-meta nums text-fg-faint" data-numeric="">
                      {favourable.length} créneau{favourable.length > 1 ? 'x' : ''} favorable
                      {favourable.length > 1 ? 's' : ''} sur 8
                    </p>
                  </Card>
                </li>
              );
            })}
          </ul>
        </section>

        <section aria-labelledby="tous" className="mt-12">
          <h2 id="tous" className="text-val-sm font-600">
            Tous les créneaux
          </h2>
          <div className="mt-6">
            <TimeWindowBar
              days={forecast.days}
              timeZone={spot.timezone}
              now={forecast.generatedAt}
            />
          </div>
        </section>
      </div>
    </>
  );
}
