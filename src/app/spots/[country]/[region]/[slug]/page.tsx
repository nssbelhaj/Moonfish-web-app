import type { Metadata } from 'next';

import { DataSourceTag } from '@/components/data/DataSourceTag';
import { DemoDataNotice, simulatedSources } from '@/components/data/DemoDataNotice';
import { DayActivityChart } from '@/components/marine/DayActivityChart';
import { MoonPhase } from '@/components/marine/MoonPhase';
import { TideChart } from '@/components/marine/TideChart';
import { WindCompass } from '@/components/marine/WindCompass';
import { ScoreGauge } from '@/components/score/ScoreGauge';
import { ScoreReasons } from '@/components/score/ScoreReasons';
import { SpotTabs } from '@/components/spot/SpotTabs';
import { Card } from '@/components/ui/Card';
import { Tag } from '@/components/ui/Tag';
import {
  BOTTOM_LABELS,
  EXPOSURE_LABELS,
  SPOT_TYPE_LABELS,
  TECHNIQUE_LABELS,
} from '@/data/spots';
import { sourceList } from '@/lib/forecast';
import { tidalRangeOf } from '@/lib/forecast/tide-curve';
import { absoluteUrl, spotPath } from '@/lib/routes';
import { formatMeasure, formatScore } from '@/lib/score-display';
import { formatDayLong, formatTime } from '@/lib/time';
import { findSpot, resolveSpot, type RouteParams } from './spot-page-data';

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}): Promise<Metadata> {
  const spot = await findSpot(params);
  if (!spot) return { title: 'Spot introuvable' };

  const species = spot.species.slice(0, 3).join(', ').toLowerCase();

  return {
    title: `${spot.name} — conditions de pêche en direct`,
    description: `Score du créneau en cours à ${spot.name} (${spot.regionName}) : marée, vent, houle et lumière. Fond de ${BOTTOM_LABELS[spot.bottom].toLowerCase()}, ${species}.`,
    alternates: { canonical: absoluteUrl(spotPath(spot)) },
  };
}

export default async function SpotLivePage({ params }: { params: Promise<RouteParams> }) {
  const { spot, forecast, now } = await resolveSpot(params);
  const current = forecast.current;
  const today = forecast.days[0];

  const tideIsSimulated = simulatedSources([forecast.sources.tide.source]).length > 0;
  const weatherIsSimulated = simulatedSources([forecast.sources.weather.source]).length > 0;

  // Handoff §5 : le créneau praticable passe en tête dès qu'une alerte de
  // sécurité est active. Le produit bascule seul, ce n'est pas un choix.
  const isDanger = current?.score.safety.level === 'danger';
  const nextPracticable = forecast.days
    .flatMap((day) => day.slots)
    .filter((slot) => new Date(slot.end).getTime() > now.getTime())
    .filter((slot) => slot.score.safety.level !== 'danger')
    .filter((slot) => slot.score.value !== null)
    .sort((a, b) => (b.score.value ?? 0) - (a.score.value ?? 0))[0];

  return (
    <>
      <div className="mx-auto w-full max-w-shell px-4 pt-6 md:px-8">
        <SpotTabs basePath={spotPath(spot)} active="live" />

        <p className="mt-6 max-w-prose text-body text-fg-muted">{spot.summary}</p>

        <div className="mt-4 flex flex-wrap gap-2">
          <Tag>{SPOT_TYPE_LABELS[spot.type]}</Tag>
          <Tag>{BOTTOM_LABELS[spot.bottom]}</Tag>
          <Tag>{EXPOSURE_LABELS[spot.exposure]}</Tag>
          {spot.techniques.map((technique) => (
            <Tag key={technique}>{TECHNIQUE_LABELS[technique]}</Tag>
          ))}
        </div>

        <div className="mt-6">
          <DemoDataNotice sources={sourceList(forecast.sources)} />
        </div>
      </div>

      <div className="mx-auto w-full max-w-shell px-4 py-8 md:px-8 md:py-12 xl:grid xl:grid-cols-[1fr_400px] xl:gap-12">
        <div>
          {isDanger && (
            <section aria-labelledby="repli" className="mb-8">
              <h2 id="repli" className="text-val-sm font-600">
                Prochain créneau praticable
              </h2>
              <Card className="mt-4 p-4">
                {nextPracticable ? (
                  <>
                    <p className="text-meta nums" data-numeric="">
                      {formatDayLong(new Date(nextPracticable.start), spot.timezone)} ·{' '}
                      {formatTime(new Date(nextPracticable.start), spot.timezone)}–
                      {formatTime(new Date(nextPracticable.end), spot.timezone)} ·{' '}
                      {formatScore(nextPracticable.score.value)}/10
                    </p>
                    <p className="mt-2 text-meta nums text-fg-muted">
                      {nextPracticable.score.reasons[0]}
                    </p>
                  </>
                ) : (
                  <p className="text-body text-fg-muted">
                    Aucun créneau praticable sur les sept prochains jours à ce spot.
                  </p>
                )}
              </Card>
            </section>
          )}

          <section aria-labelledby="score">
            <h2 id="score" className="text-val-sm font-600">
              Créneau en cours
            </h2>

            {current ? (
              <div className="mt-4">
                <p className="text-meta nums text-fg-faint" data-numeric="">
                  {formatDayLong(new Date(current.start), spot.timezone)} ·{' '}
                  {formatTime(new Date(current.start), spot.timezone)}–
                  {formatTime(new Date(current.end), spot.timezone)} (heure locale)
                </p>
                <div className="mt-3">
                  <ScoreGauge score={current.score} />
                </div>
                <ScoreReasons reasons={current.score.reasons} />
              </div>
            ) : (
              <p className="mt-4 text-meta nums text-fg-faint">
                Score indisponible pour ce créneau.
              </p>
            )}
          </section>

          {today && (
            <section aria-labelledby="journee" className="mt-10">
              <h2 id="journee" className="text-val-sm font-600">
                La journée d’un coup d’œil
              </h2>
              <p className="mt-2 max-w-prose text-body text-fg-muted">
                La hauteur d’eau, les huit créneaux de trois heures et ceux qui ressortent.{' '}
                {tideIsSimulated
                  ? 'Les marées affichées ici sont simulées ; le lever et le coucher du soleil, eux, sont calculés.'
                  : 'Marées et météo sont réelles ; le lever et le coucher du soleil sont calculés localement.'}
              </p>
              <div className="mt-4">
                <DayActivityChart
                  day={today}
                  tideEvents={forecast.tideEvents}
                  timeZone={spot.timezone}
                  now={forecast.generatedAt}
                />
              </div>
            </section>
          )}
        </div>

        <aside className="mt-10 xl:mt-0">
          <section
            aria-labelledby="marees"
            className={tideIsSimulated ? 'demo-frame p-4' : 'surface p-4'}
          >
            <DemoDataNotice sources={[forecast.sources.tide.source]} compact />
            <h2 id="marees" className="mt-2 text-val-sm font-600">
              Marées du jour
            </h2>
            {today && (
              <>
                <p className="mt-2 text-meta nums text-fg-muted" data-numeric="">
                  Coefficient {today.tideEvents[0]?.coefficient ?? '—'} ·{' '}
                  {(() => {
                    const range = tidalRangeOf(today.tideEvents);
                    return range === null
                      ? `marnage moyen ${spot.meanTideRangeM.toFixed(1).replace('.', ',')} m`
                      : `marnage du jour ${range.toFixed(1).replace('.', ',')} m`;
                  })()}
                </p>
                <div className="mt-4">
                  <TideChart
                    events={today.tideEvents}
                    timeZone={spot.timezone}
                    dayStart={today.date}
                  />
                </div>
              </>
            )}
            <DataSourceTag
              status={forecast.sources.tide}
              serverNow={forecast.generatedAt}
              timeZone={spot.timezone}
            />
          </section>

          <section
            aria-labelledby="meteo"
            className={
              weatherIsSimulated ? 'demo-frame mt-6 p-4' : 'mt-6 surface p-4'
            }
          >
            <DemoDataNotice sources={[forecast.sources.weather.source]} compact />
            <h2 id="meteo" className="mt-2 text-val-sm font-600">
              Vent et état de mer
            </h2>
            {current && current.conditions ? (
              <>
                <div className="mt-4">
                  <WindCompass
                    fromDeg={current.conditions.windFromDeg}
                    speedKmh={current.conditions.windSpeedKmh}
                    gustKmh={current.conditions.windGustKmh}
                    spotFacingDeg={spot.facingDeg}
                  />
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-meta nums">
                  {[
                    ['Houle', formatMeasure(current.conditions.swellHeightM, 'm', 1)],
                    ['Période', formatMeasure(current.conditions.swellPeriodS, 's', 0)],
                    ['Eau', formatMeasure(current.conditions.waterTempC, '°C', 1)],
                    ['Air', formatMeasure(current.conditions.airTempC, '°C', 1)],
                    ['Nuages', formatMeasure(current.conditions.cloudCoverPct, '%', 0)],
                    ['Pression', formatMeasure(current.conditions.pressureHpa, 'hPa', 0)],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-meta text-fg-faint">
                        {label}
                      </dt>
                      <dd className="mt-0.5 text-fg-muted" data-numeric="">
                        {value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </>
            ) : (
              <p className="mt-4 text-meta nums text-fg-faint">Conditions indisponibles.</p>
            )}
            <DataSourceTag
              status={forecast.sources.weather}
              serverNow={forecast.generatedAt}
              timeZone={spot.timezone}
            />
          </section>

          <section aria-labelledby="lune" className="mt-6 surface p-4">
            <h2 id="lune" className="text-val-sm font-600">
              Lune et lumière
            </h2>
            {today && (
              <>
                <div className="mt-4">
                  <MoonPhase
                    ageDays={today.moonAgeDays}
                    illuminationPct={today.moonIlluminationPct}
                  />
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-meta nums">
                  <div>
                    <dt className="text-meta text-fg-faint">
                      Lever du soleil
                    </dt>
                    <dd className="mt-0.5 text-fg-muted" data-numeric="">
                      {today.sunrise
                        ? formatTime(new Date(today.sunrise), spot.timezone)
                        : 'Indispo.'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-meta text-fg-faint">
                      Coucher du soleil
                    </dt>
                    <dd className="mt-0.5 text-fg-muted" data-numeric="">
                      {today.sunset ? formatTime(new Date(today.sunset), spot.timezone) : 'Indispo.'}
                    </dd>
                  </div>
                </dl>
                {current && (
                  <p className="mt-3 text-meta nums text-fg-muted">
                    {current.score.breakdown.solunar.note}
                  </p>
                )}
              </>
            )}
            <DataSourceTag
              status={forecast.sources.astro}
              serverNow={forecast.generatedAt}
              timeZone={spot.timezone}
            />
          </section>
        </aside>
      </div>
    </>
  );
}
