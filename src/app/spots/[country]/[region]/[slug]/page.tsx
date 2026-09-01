import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { DataSourceTag } from '@/components/data/DataSourceTag';
import { DemoDataNotice, simulatedSources } from '@/components/data/DemoDataNotice';
import { EmailCaptureForm } from '@/components/forms/EmailCaptureForm';
import { DayActivityChart } from '@/components/marine/DayActivityChart';
import { MoonPhase } from '@/components/marine/MoonPhase';
import { TideChart } from '@/components/marine/TideChart';
import { TimeWindowBar } from '@/components/marine/TimeWindowBar';
import { WindCompass } from '@/components/marine/WindCompass';
import { ScoreBreakdown } from '@/components/score/ScoreBreakdown';
import { ScoreGauge } from '@/components/score/ScoreGauge';
import { ScoreReasons } from '@/components/score/ScoreReasons';
import { SafetyBanner } from '@/components/spot/SafetyBanner';
import { Card } from '@/components/ui/Card';
import { Tag } from '@/components/ui/Tag';
import {
  BOTTOM_LABELS,
  EXPOSURE_LABELS,
  SPOT_TYPE_LABELS,
  TECHNIQUE_DESCRIPTIONS,
  TECHNIQUE_LABELS,
} from '@/data/spots';
import { getSpotForecast, referenceNow, type ForecastSlot } from '@/lib/forecast';
import { tidalRangeOf } from '@/lib/forecast/tide-curve';
import { shelteredNearby } from '@/lib/geo';
import { spots as spotRepository } from '@/lib/providers';
import { absoluteUrl, spotPath } from '@/lib/routes';
import { formatMeasure } from '@/lib/score-display';
import { formatDateTime, formatDayLong, formatTime } from '@/lib/time';

export const revalidate = 3600;

interface RouteParams {
  country: string;
  region: string;
  slug: string;
}

/** Les 12 spots sont pré-rendus au build : la page détail est entièrement statique. */
export async function generateStaticParams(): Promise<RouteParams[]> {
  const all = await spotRepository.list();
  return all.map((spot) => ({
    country: spot.countrySlug,
    region: spot.regionSlug,
    slug: spot.slug,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}): Promise<Metadata> {
  const { country, region, slug } = await params;
  const spot = await spotRepository.findByPath(country, region, slug);
  if (!spot) return { title: 'Spot introuvable' };

  const path = spotPath(spot);
  const species = spot.species.slice(0, 3).join(', ').toLowerCase();
  const techniqueList = spot.techniques.map((technique) => TECHNIQUE_LABELS[technique]).join(', ');

  return {
    title: `${spot.name} — score de pêche, marées et vent sur 7 jours`,
    description: `Conditions de pêche du bord à ${spot.name} (${spot.regionName}) : score par créneau de 3 h sur 7 jours, marées, vent, houle et périodes solunaires. ${techniqueList}. Fond de ${BOTTOM_LABELS[spot.bottom].toLowerCase()}, ${species}.`,
    alternates: { canonical: absoluteUrl(path) },
    openGraph: {
      type: 'article',
      title: `${spot.name} — conditions de pêche du bord`,
      description: `${EXPOSURE_LABELS[spot.exposure]}, fond de ${BOTTOM_LABELS[spot.bottom].toLowerCase()}. Score, marées et vent sur 7 jours.`,
      url: absoluteUrl(path),
    },
  };
}

function SlotLine({ slot, timeZone }: { slot: ForecastSlot; timeZone: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <p className="font-mono text-data text-fg" data-numeric="">
        {formatDayLong(new Date(slot.start), timeZone)} · {formatTime(new Date(slot.start), timeZone)}
        –{formatTime(new Date(slot.end), timeZone)}
      </p>
      <p className="font-mono text-data text-fg-muted" data-numeric="">
        {slot.score.value.toFixed(1).replace('.', ',')}/10 · {slot.score.label}
      </p>
    </div>
  );
}

export default async function SpotPage({ params }: { params: Promise<RouteParams> }) {
  const { country, region, slug } = await params;
  const spot = await spotRepository.findByPath(country, region, slug);
  if (!spot) notFound();

  const now = referenceNow();
  const forecast = await getSpotForecast(spot, now);
  const current = forecast.current;
  const today = forecast.days[0];

  const allSpots = await spotRepository.list();
  const shelters = shelteredNearby(spot, allSpots, 20);

  const isDanger = current?.score.safety.level === 'danger';

  // Le cadre pointillé suit la source du BLOC, pas la page : depuis le
  // branchement d'Open-Meteo, la marée est encore simulée alors que le vent et
  // la houle sont réels. Encadrer les deux à l'identique serait faux.
  const tideIsSimulated = simulatedSources([forecast.sources.tide]).length > 0;
  const weatherIsSimulated = simulatedSources([forecast.sources.weather]).length > 0;

  // Handoff §5 : variante 1a (score en tête) en conditions normales, 1b
  // (créneau praticable en tête) dès qu'une alerte de sécurité est active.
  // Le produit bascule seul, ce n'est pas un choix utilisateur.
  const layoutVariant = isDanger ? '1b' : '1a';

  const bestSlots = forecast.days
    .flatMap((day) => day.slots)
    .filter((slot) => new Date(slot.end).getTime() > now.getTime())
    .filter((slot) => slot.score.safety.level !== 'danger')
    .sort((a, b) => b.score.value - a.score.value)
    .slice(0, 5);

  const placeJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Place',
    name: spot.name,
    description: spot.summary,
    url: absoluteUrl(spotPath(spot)),
    geo: {
      '@type': 'GeoCoordinates',
      latitude: spot.lat,
      longitude: spot.lng,
    },
    address: {
      '@type': 'PostalAddress',
      addressRegion: spot.regionName,
      addressCountry: spot.countryName === 'France' ? 'FR' : 'MA',
    },
    additionalProperty: [
      { '@type': 'PropertyValue', name: 'Exposition', value: EXPOSURE_LABELS[spot.exposure] },
      { '@type': 'PropertyValue', name: 'Type de fond', value: BOTTOM_LABELS[spot.bottom] },
      { '@type': 'PropertyValue', name: 'Marnage moyen', value: `${spot.meanTideRangeM} m` },
      { '@type': 'PropertyValue', name: 'Espèces cibles', value: spot.species.join(', ') },
      {
        '@type': 'PropertyValue',
        name: 'Techniques praticables',
        value: spot.techniques.map((technique) => TECHNIQUE_LABELS[technique]).join(', '),
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(placeJsonLd) }}
      />

      {current && current.score.safety.level !== 'ok' && (
        <div className="mx-auto w-full max-w-shell px-4 pt-4 md:px-8">
          <SafetyBanner
            level={current.score.safety.level}
            message={current.score.safety.message}
            {...(shelters.length > 0
              ? {
                  shelterHref: spotPath(shelters[0]!),
                  shelterCount: shelters.length,
                }
              : {})}
          />
          {isDanger && shelters.length === 0 && (
            <p className="mt-3 font-mono text-data text-fg-muted">
              Aucun spot plus abrité du catalogue n’est à moins de 20 km. Consultez{' '}
              <Link href="/spots" className="underline decoration-dotted underline-offset-4">
                la liste complète
              </Link>{' '}
              ou reportez la sortie.
            </p>
          )}
        </div>
      )}

      <div className="mx-auto w-full max-w-shell px-4 pt-6 md:px-8 md:pt-10">
        <nav aria-label="Fil d’Ariane" className="font-mono text-data text-fg-muted">
          <Link href="/spots" className="underline decoration-dotted underline-offset-4">
            Spots
          </Link>
          {' / '}
          <Link
            href={`/spots?pays=${spot.countrySlug}`}
            className="underline decoration-dotted underline-offset-4"
          >
            {spot.countryName}
          </Link>
          {' / '}
          <Link
            href={`/spots?region=${spot.regionSlug}`}
            className="underline decoration-dotted underline-offset-4"
          >
            {spot.regionName}
          </Link>
        </nav>

        <h1 className="mt-3 text-h1 font-700">{spot.name}</h1>
        <p className="mt-3 max-w-measure text-body text-fg-muted">{spot.summary}</p>

        <div className="mt-6">
          <DemoDataNotice sources={Object.values(forecast.sources)} />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Tag>{SPOT_TYPE_LABELS[spot.type]}</Tag>
          <Tag>{BOTTOM_LABELS[spot.bottom]}</Tag>
          <Tag>{EXPOSURE_LABELS[spot.exposure]}</Tag>
          <Tag>Marnage {spot.meanTideRangeM.toFixed(1).replace('.', ',')} m</Tag>
          {spot.techniques.map((technique) => (
            <Tag key={technique}>{TECHNIQUE_LABELS[technique]}</Tag>
          ))}
        </div>
      </div>

      <div className="mx-auto w-full max-w-shell px-4 py-8 md:px-8 md:py-12 xl:grid xl:grid-cols-[1fr_400px] xl:gap-12">
        <div>
          {layoutVariant === '1b' && (
            <section aria-labelledby="repli" className="mb-8">
              <h2 id="repli" className="text-h2 font-600">
                Prochain créneau praticable
              </h2>
              <Card className="mt-4 p-4">
                {bestSlots[0] ? (
                  <>
                    <SlotLine slot={bestSlots[0]} timeZone={spot.timezone} />
                    <p className="mt-2 font-mono text-data text-fg-muted">
                      {bestSlots[0].score.reasons[0]}
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
            <h2 id="score" className="text-h2 font-600">
              {layoutVariant === '1b' ? 'Score du créneau en cours' : 'Créneau en cours'}
            </h2>

            {current ? (
              <div className="mt-4">
                <p className="font-mono text-data text-fg-dim" data-numeric="">
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
              <p className="mt-4 font-mono text-data text-fg-dim">
                Score indisponible pour ce créneau.
              </p>
            )}
          </section>

          {today && (
            <section aria-labelledby="journee" className="mt-10">
              <h2 id="journee" className="text-h2 font-600">
                La journée d’un coup d’œil
              </h2>
              <p className="mt-2 max-w-measure text-body text-fg-muted">
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

          <section aria-labelledby="detail" className="mt-10">
            <h2 id="detail" className="text-h2 font-600">
              Le détail du calcul
            </h2>
            <p className="mt-2 max-w-measure text-body text-fg-muted">
              Chaque facteur est noté sur 10, puis pondéré. Le poids est affiché : sans lui, un bon
              score de lumière paraîtrait aussi décisif qu’un bon score de marée, alors qu’il pèse
              sept fois moins.
            </p>
            {current && (
              <div className="mt-4">
                <ScoreBreakdown score={current.score} />
              </div>
            )}
          </section>

          <section aria-labelledby="fenetres" className="mt-10">
            <h2 id="fenetres" className="text-h2 font-600">
              Les meilleurs créneaux des 7 jours
            </h2>
            <p className="mt-2 max-w-measure text-body text-fg-muted">
              Classés par score, hors conditions dangereuses. Un créneau dangereux n’est jamais
              recommandé, quel que soit son score halieutique.
            </p>
            <ul className="mt-4 divide-y divide-edge">
              {bestSlots.map((slot) => (
                <li key={slot.start} className="py-3">
                  <SlotLine slot={slot} timeZone={spot.timezone} />
                  <p className="mt-1 font-mono text-data text-fg-dim">{slot.score.reasons[1] ?? slot.score.reasons[0]}</p>
                </li>
              ))}
              {bestSlots.length === 0 && (
                <li className="py-3 text-body text-fg-muted">
                  Aucun créneau praticable sur la période.
                </li>
              )}
            </ul>

            <div className="mt-8">
              <h3 className="text-h3 font-600">Tous les créneaux, jour par jour</h3>
              <div className="mt-4">
                <TimeWindowBar
                  days={forecast.days}
                  timeZone={spot.timezone}
                  now={forecast.generatedAt}
                />
              </div>
            </div>
          </section>
        </div>

        <aside className="mt-10 xl:mt-0">
          <section
            aria-labelledby="marees"
            className={tideIsSimulated ? 'demo-frame p-4' : 'rounded-card border border-edge p-4'}
          >
            <DemoDataNotice sources={[forecast.sources.tide]} compact />
            <h2 id="marees" className="mt-2 text-h2 font-600">
              Marées du jour
            </h2>
            {today && (
              <>
                <p className="mt-2 font-mono text-data text-fg-muted" data-numeric="">
                  Coefficient {today.tideEvents[0]?.coefficient ?? '—'} ·{' '}
                  {/* Le marnage du JOUR, calculé sur les extremums affichés — pas
                      la moyenne du spot, qui les contredirait sous les yeux du lecteur. */}
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
              source={forecast.sources.tide}
              refreshedAt={forecast.generatedAt}
              timeZone={spot.timezone}
            />
          </section>

          <section
            aria-labelledby="meteo"
            className={
              weatherIsSimulated ? 'demo-frame mt-6 p-4' : 'mt-6 rounded-card border border-edge p-4'
            }
          >
            <DemoDataNotice sources={[forecast.sources.weather]} compact />
            <h2 id="meteo" className="mt-2 text-h2 font-600">
              Vent et état de mer
            </h2>
            {current ? (
              <>
                <div className="mt-4">
                  <WindCompass
                    fromDeg={current.conditions.windFromDeg}
                    speedKmh={current.conditions.windSpeedKmh}
                    gustKmh={current.conditions.windGustKmh}
                    spotFacingDeg={spot.facingDeg}
                  />
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-3 font-mono text-data">
                  {[
                    ['Houle', formatMeasure(current.conditions.swellHeightM, 'm', 1)],
                    ['Période', formatMeasure(current.conditions.swellPeriodS, 's', 0)],
                    ['Eau', formatMeasure(current.conditions.waterTempC, '°C', 1)],
                    ['Air', formatMeasure(current.conditions.airTempC, '°C', 1)],
                    ['Nuages', formatMeasure(current.conditions.cloudCoverPct, '%', 0)],
                    ['Pression', formatMeasure(current.conditions.pressureHpa, 'hPa', 0)],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-[0.6875rem] uppercase tracking-[0.14em] text-fg-dim">
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
              <p className="mt-4 font-mono text-data text-fg-dim">Conditions indisponibles.</p>
            )}
            <DataSourceTag
              source={forecast.sources.weather}
              refreshedAt={forecast.generatedAt}
              timeZone={spot.timezone}
            />
          </section>

          <section aria-labelledby="lune" className="mt-6 rounded-card border border-edge p-4">
            <h2 id="lune" className="text-h2 font-600">
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
                <dl className="mt-4 grid grid-cols-2 gap-3 font-mono text-data">
                  <div>
                    <dt className="text-[0.6875rem] uppercase tracking-[0.14em] text-fg-dim">
                      Lever du soleil
                    </dt>
                    <dd className="mt-0.5 text-fg-muted" data-numeric="">
                      {today.sunrise ? formatTime(new Date(today.sunrise), spot.timezone) : 'Indispo.'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[0.6875rem] uppercase tracking-[0.14em] text-fg-dim">
                      Coucher du soleil
                    </dt>
                    <dd className="mt-0.5 text-fg-muted" data-numeric="">
                      {today.sunset ? formatTime(new Date(today.sunset), spot.timezone) : 'Indispo.'}
                    </dd>
                  </div>
                </dl>
                {current && (
                  <p className="mt-3 font-mono text-data text-fg-muted">
                    {current.score.breakdown.solunar.note}
                  </p>
                )}
              </>
            )}
            <DataSourceTag source={forecast.sources.astro} refreshedAt={forecast.generatedAt} timeZone={spot.timezone} />
          </section>

          <section aria-labelledby="techniques" className="mt-6 rounded-card border border-edge p-4">
            <h2 id="techniques" className="text-h2 font-600">
              Techniques praticables
            </h2>
            <p className="mt-2 text-body text-fg-muted">
              Ce qui se pratique réellement ici, selon le fond et l’accès. Le score, lui, est
              calibré pour la pêche du bord en général : il ne se décline pas encore par technique.
            </p>
            <dl className="mt-4 divide-y divide-edge">
              {spot.techniques.map((technique) => (
                <div key={technique} className="py-3">
                  <dt className="text-h3 font-600">{TECHNIQUE_LABELS[technique]}</dt>
                  <dd className="mt-1 text-body text-fg-muted">
                    {TECHNIQUE_DESCRIPTIONS[technique]}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          <section aria-labelledby="acces" className="mt-6 rounded-card border border-edge p-4">
            <h2 id="acces" className="text-h2 font-600">
              Accès et espèces
            </h2>
            <p className="mt-2 text-body text-fg-muted">{spot.access}</p>
            <p className="mt-3 font-mono text-data text-fg-muted">
              Espèces cibles : {spot.species.join(', ')}.
            </p>
            <p className="mt-3 font-mono text-data text-fg-dim" data-numeric="">
              {spot.lat.toFixed(4).replace('.', ',')}, {spot.lng.toFixed(4).replace('.', ',')} ·
              orientation {Math.round(spot.facingDeg)}° vers le large
            </p>
          </section>

          <section aria-labelledby="alerte" className="mt-6 rounded-card border border-edge p-4">
            <h2 id="alerte" className="text-h2 font-600">
              Être prévenu pour ce spot
            </h2>
            <p className="mt-2 text-body text-fg-muted">
              Les alertes sur les bonnes fenêtres font partie du plan Pro, qui n’existe pas encore.
              Laissez votre adresse pour être prévenu au lancement.
            </p>
            <div className="mt-4">
              <EmailCaptureForm source={`spot:${spot.slug}`} />
            </div>
          </section>
        </aside>
      </div>

      <div className="mx-auto w-full max-w-shell px-4 pb-12 md:px-8">
        <p className="font-mono text-data text-fg-dim">
          Dernier calcul : {formatDateTime(new Date(forecast.generatedAt), spot.timezone)} (heure de{' '}
          {spot.timezone}).
        </p>
      </div>
    </>
  );
}
