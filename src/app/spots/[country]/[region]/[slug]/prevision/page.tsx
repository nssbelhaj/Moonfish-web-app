import type { Metadata } from 'next';

import { DemoDataNotice } from '@/components/data/DemoDataNotice';
import { SpotTabs } from '@/components/spot/SpotTabs';
import { SlotTable } from '@/components/v3/SlotTable';
import { TideActivityChart } from '@/components/v3/TideActivityChart';
import { MoonTimesInline } from '@/components/v3/MoonTimes';
import { WaterValue } from '@/components/v3/WaterValue';
import { sourceList } from '@/lib/forecast';
import { tidalRangeOf } from '@/lib/forecast/tide-curve';
import { absoluteUrl, spotPath } from '@/lib/routes';
import { formatMeasure, formatScore, tierForOrNull } from '@/lib/score-display';
import {
  formatDayLong,
  formatDayNumber,
  formatTime,
  formatWeekdayShort,
  localDateKey,
} from '@/lib/time';
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

/**
 * Bascule d'un jour à l'autre, SANS JavaScript.
 *
 * ─── Ce que la page faisait avant, et pourquoi ça ne allait pas ───────────
 *
 * Les sept jours s'empilaient les uns sous les autres. Chacun portant un
 * graphique de marée et douze créneaux, atteindre samedi demandait six écrans
 * de défilement, et rien ne disait où l'on se trouvait. Une prévision se
 * consulte par comparaison — « et si j'y allais plutôt jeudi ? » — et
 * l'empilement rendait précisément cette comparaison pénible.
 *
 * ─── Pourquoi `:target` plutôt qu'un composant client ─────────────────────
 *
 * Un onglet réclame d'ordinaire un état, donc du JavaScript, donc une page
 * rendue côté client. Ici l'état est déjà dans l'URL : c'est le fragment.
 * `:target` le lit, et trois conséquences en découlent, toutes voulues :
 *
 *   · la page reste ENTIÈREMENT pré-rendue — pas une ligne de JavaScript
 *     ajoutée au paquet, sur un site consulté au bord de l'eau en 4G faible ;
 *   · l'adresse d'un jour se partage : `…/prevision#jour-2026-09-05` ouvre
 *     directement jeudi, ce qu'un état client ne permet pas ;
 *   · sans JavaScript, ça marche quand même.
 *
 * ─── Le repli, qui n'en est pas vraiment un ───────────────────────────────
 *
 * Le masquage s'appuie sur `:has()`, faute de quoi CSS ne sait pas exprimer
 * « aucun jour n'est ciblé ». Un navigateur qui l'ignore affiche les sept
 * jours empilés, c'est-à-dire EXACTEMENT le comportement précédent. La
 * dégradation ramène à l'ancienne page, jamais à une page cassée.
 */
function styleBascule(dates: readonly string[]): string {
  const premier = dates[0];
  if (premier === undefined) return '';

  const actif = dates
    .map((date) => `body:has(#jour-${date}:target) [data-jour="${date}"]`)
    .concat(`body:not(:has(.jour:target)) [data-jour="${premier}"]`)
    .join(',');

  return [
    'body:has(.jour:target) .jour:not(:target){display:none}',
    `body:not(:has(.jour:target)) .jour:not(:first-of-type){display:none}`,
    `${actif}{background-color:var(--surface-2);color:var(--fg)}`,
    `${actif} .jour-onglet-jour{font-weight:700}`,
  ].join('');
}

export default async function SpotForecastPage({ params }: { params: Promise<RouteParams> }) {
  const { spot, forecast, now } = await resolveSpot(params);
  const nowMs = now.getTime();
  const dates = forecast.days.map((day) => localDateKey(new Date(day.date), spot.timezone));

  return (
    <>
      <style>{styleBascule(dates)}</style>

      <div className="mx-auto w-full max-w-shell px-4 pt-6 md:px-8">
        <SpotTabs basePath={spotPath(spot)} active="prevision" />
        <div className="mt-6">
          <DemoDataNotice sources={sourceList(forecast.sources)} />
        </div>
      </div>

      <div className="mx-auto w-full max-w-shell px-4 py-8 md:px-8 md:py-12">
        <nav aria-label="Choisir un jour" className="surface p-2">
          <ul className="flex items-stretch gap-1 overflow-x-auto">
            {forecast.days.map((day, index) => {
              const date = new Date(day.date);
              const cle = localDateKey(date, spot.timezone);
              const coefficient = day.tideEvents[0]?.coefficient ?? null;
              const tier = tierForOrNull(day.best?.score.value ?? null);

              return (
                <li key={day.date} className="min-w-[54px] flex-1">
                  <a
                    href={`#jour-${cle}`}
                    data-jour={cle}
                    className="flex min-h-tap flex-col items-center justify-center gap-[4px] rounded-[8px] py-[7px] text-fg-muted tappable"
                  >
                    <span className="text-[11px]">
                      {index === 0 ? "auj." : formatWeekdayShort(date, spot.timezone)}
                    </span>
                    <span className="jour-onglet-jour text-[15px] font-semibold nums" data-numeric="">
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
          const cle = localDateKey(new Date(day.date), spot.timezone);

          return (
            <section
              key={day.date}
              id={`jour-${cle}`}
              aria-labelledby={`titre-${cle}`}
              className="jour mt-8 scroll-mt-4"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h2
                  id={`titre-${cle}`}
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

              <div className="mt-4">
                <TideActivityChart
                  day={day}
                  tideEvents={forecast.tideEvents}
                  timeZone={spot.timezone}
                  now={forecast.generatedAt}
                  coefficient={coefficient}
                />
              </div>

              <div className="surface mt-4 p-[14px]">
                <h3 className="card-title">Les créneaux du jour</h3>
                <div className="mt-2">
                  <SlotTable
                    slots={day.slots}
                    timeZone={spot.timezone}
                    /*
                      Le repère « en cours » n'a de sens que pour aujourd'hui.
                      Le porter sur les autres jours désignerait un créneau qui
                      n'est pas en train de se produire.
                    */
                    nowMs={index === 0 ? nowMs : null}
                    legende={`Créneaux du ${formatDayLong(new Date(day.date), spot.timezone)} à ${spot.name} : note, marée, vent, mer et lumière.`}
                  />
                </div>

                <p className="card-source mt-2">
                  Coefficient <WaterValue className="nums">{coefficient ?? '—'}</WaterValue>
                  {range !== null && (
                    <>
                      {' · marnage '}
                      <WaterValue className="nums">{formatMeasure(range, 'm', 2)}</WaterValue>
                    </>
                  )}
                  {day.sunrise && day.sunset && (
                    <>
                      {' · soleil '}
                      <span className="nums">
                        {formatTime(new Date(day.sunrise), spot.timezone)}
                      </span>
                      {'–'}
                      <span className="nums">
                        {formatTime(new Date(day.sunset), spot.timezone)}
                      </span>
                    </>
                  )}
                  {' · '}
                  <MoonTimesInline
                    moonrise={day.moonrise}
                    moonset={day.moonset}
                    timeZone={spot.timezone}
                  />
                </p>
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
