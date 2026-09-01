import type { TideEvent } from '@/data/schemas';
import { favourableSlots, type ForecastDay } from '@/lib/forecast';
import { eventsAround, sampleTideCurve, tideBounds, tideHeightAt } from '@/lib/forecast/tide-curve';
import { UNAVAILABLE_COLOR_VAR, formatScore, tierForOrNull } from '@/lib/score-display';
import { addHours, formatTime } from '@/lib/time';
import { FishGlyph } from './FishGlyph';

const VIEW_W = 1000;
const VIEW_H = 180;

interface Band {
  fromPct: number;
  toPct: number;
}

function pctOf(time: number, start: number, end: number): number {
  return ((time - start) / (end - start)) * 100;
}

function clampPct(value: number): number {
  return Math.max(0, Math.min(100, value));
}

/**
 * La journée en un seul instrument : marée, score et créneaux favorables.
 *
 * Trois canaux visuels distincts, jamais superposés sur une même échelle —
 * mêler une hauteur d'eau en mètres et un score sur 10 sur un axe commun
 * produirait un graphique joli et faux.
 *
 *   · la courbe          → l'évolution de la hauteur d'eau
 *   · les bandes claires → les créneaux de 3 h les plus favorables
 *   · les poissons       → l'intensité attendue sur ces créneaux
 *   · la réglette basse  → le score de chacun des 8 créneaux
 *
 * Le texte est en DOM et jamais dans le SVG : un `<text>` mis à l'échelle avec
 * le tracé tomberait à 5 px de haut sur un écran de 375, très en dessous du
 * plancher de 14 px. Le SVG ne porte donc que du trait, ce qui lui permet
 * d'être étiré horizontalement sans rien déformer de lisible.
 */
export function DayActivityChart({
  day,
  tideEvents,
  timeZone,
  now,
}: {
  day: ForecastDay;
  /** Tous les extremums de la prévision : la courbe a besoin de déborder du jour. */
  tideEvents: readonly TideEvent[];
  timeZone: string;
  /** Instant de référence, ISO. */
  now: string;
}) {
  const dayStart = new Date(day.date);
  const dayEnd = addHours(dayStart, 24);
  const startMs = dayStart.getTime();
  const endMs = dayEnd.getTime();

  const relevantEvents = eventsAround(tideEvents, dayStart, dayEnd);
  const bounds = tideBounds(relevantEvents);
  const samples = bounds ? sampleTideCurve(relevantEvents, dayStart, dayEnd, 192) : [];

  const curvePoints = bounds
    ? samples
        .map((sample) => {
          const x = (pctOf(sample.time, startMs, endMs) / 100) * VIEW_W;
          const y = (1 - (sample.heightM - bounds.min) / (bounds.max - bounds.min)) * VIEW_H;
          return `${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(' ')
    : '';

  const favourable = favourableSlots(day.slots);

  const bands: (Band & { color: string })[] = favourable.map((slot) => ({
    fromPct: clampPct(pctOf(new Date(slot.start).getTime(), startMs, endMs)),
    toPct: clampPct(pctOf(new Date(slot.end).getTime(), startMs, endMs)),
    color: tierForOrNull(slot.score.value)?.colorVar ?? UNAVAILABLE_COLOR_VAR,
  }));

  // Ruban jour/nuit. Le lever et le coucher sont calculés, pas simulés.
  const sunrisePct = day.sunrise ? clampPct(pctOf(new Date(day.sunrise).getTime(), startMs, endMs)) : null;
  const sunsetPct = day.sunset ? clampPct(pctOf(new Date(day.sunset).getTime(), startMs, endMs)) : null;
  const nightBands: Band[] =
    sunrisePct === null || sunsetPct === null
      ? [{ fromPct: 0, toPct: 100 }]
      : [
          { fromPct: 0, toPct: sunrisePct },
          { fromPct: sunsetPct, toPct: 100 },
        ];

  const nowMs = new Date(now).getTime();
  const nowPct = nowMs >= startMs && nowMs < endMs ? pctOf(nowMs, startMs, endMs) : null;

  const dayEventMarkers = relevantEvents
    .filter((event) => {
      const t = new Date(event.time).getTime();
      return t >= startMs && t <= endMs;
    })
    .map((event) => {
      const t = new Date(event.time).getTime();
      const heightM = tideHeightAt(new Date(t), relevantEvents) ?? event.heightM;
      return {
        event,
        leftPct: clampPct(pctOf(t, startMs, endMs)),
        topPct: bounds
          ? clampPct((1 - (heightM - bounds.min) / (bounds.max - bounds.min)) * 100)
          : 50,
      };
    });

  const summary =
    favourable.length === 0
      ? 'Aucun créneau favorable sur cette journée.'
      : `Créneaux favorables : ${favourable
          .map(
            (slot) =>
              `${formatTime(new Date(slot.start), timeZone)}–${formatTime(new Date(slot.end), timeZone)} (${formatScore(slot.score.value)} sur 10)`,
          )
          .join(', ')}.`;

  return (
    <figure className="surface p-4">
      {/* Rangée des poissons, au-dessus du tracé. */}
      <div className="relative h-8" aria-hidden="true">
        {favourable.map((slot) => {
          const tier = tierForOrNull(slot.score.value);
          // `favourableSlots` écarte déjà les créneaux sans score ; ce garde-fou
          // rend l'invariant lisible au typage plutôt que de l'affirmer.
          if (tier === null) return null;
          const centre = clampPct(
            (pctOf(new Date(slot.start).getTime(), startMs, endMs) +
              pctOf(new Date(slot.end).getTime(), startMs, endMs)) /
              2,
          );
          return (
            <span
              key={slot.start}
              className="absolute bottom-0 flex -translate-x-1/2 gap-[2px]"
              style={{ left: `${centre}%` }}
            >
              <FishGlyph color={tier.colorVar} size={16} />
              {tier.tier === 4 && <FishGlyph color={tier.colorVar} size={16} />}
            </span>
          );
        })}
      </div>

      <div className="relative h-[180px]">
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full"
          role="img"
          aria-label={`Marée et créneaux favorables de la journée. ${summary}`}
        >
          {/* Nuit : une non-couleur, pour que l'absence de jour ne ressemble pas
              à un mauvais créneau. */}
          {nightBands.map((band, index) => (
            <rect
              key={`night-${index}`}
              x={(band.fromPct / 100) * VIEW_W}
              y={0}
              width={((band.toPct - band.fromPct) / 100) * VIEW_W}
              height={VIEW_H}
              fill="var(--surface-2)"
            />
          ))}

          {bands.map((band, index) => (
            <g key={`fav-${index}`}>
              <rect
                x={(band.fromPct / 100) * VIEW_W}
                y={0}
                width={((band.toPct - band.fromPct) / 100) * VIEW_W}
                height={VIEW_H}
                fill="var(--surface-2)"
              />
              {/* Le liseré est ce qui rend la fenêtre repérable : le fond seul se
                  confond avec la bande de nuit, tous deux verts sombres. */}
              <line
                x1={(band.fromPct / 100) * VIEW_W}
                y1={1}
                x2={(band.toPct / 100) * VIEW_W}
                y2={1}
                stroke={band.color}
                strokeWidth="3"
                vectorEffect="non-scaling-stroke"
              />
            </g>
          ))}

          {[3, 6, 9, 12, 15, 18, 21].map((hour) => (
            <line
              key={hour}
              x1={(hour / 24) * VIEW_W}
              y1={0}
              x2={(hour / 24) * VIEW_W}
              y2={VIEW_H}
              stroke="var(--edge)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          ))}

          {curvePoints && (
            <polyline
              points={curvePoints}
              fill="none"
              stroke="var(--score-3)"
              strokeWidth="2"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          )}

          {nowPct !== null && (
            <line
              x1={(nowPct / 100) * VIEW_W}
              y1={0}
              x2={(nowPct / 100) * VIEW_W}
              y2={VIEW_H}
              stroke="var(--fg)"
              strokeWidth="1.5"
              strokeDasharray="4 4"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>

        {/* Repères de pleine et basse mer, en DOM pour rester nets et lisibles. */}
        {dayEventMarkers.map(({ event, leftPct, topPct }) => (
          <span
            key={event.time}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${leftPct}%`, top: `${topPct}%` }}
          >
            <span className="block h-2 w-2 rounded-full border border-fg bg-page" />
          </span>
        ))}

        {!curvePoints && (
          <p className="absolute inset-0 flex items-center justify-center text-meta nums text-fg-faint">
            Courbe de marée indisponible.
          </p>
        )}
      </div>

      {/* Réglette des 8 créneaux de 3 h. */}
      <div className="mt-2 flex gap-[2px]" aria-hidden="true">
        {day.slots.map((slot) => {
          const tier = tierForOrNull(slot.score.value);
          const isDanger = slot.score.safety.level === 'danger';
          return (
            <span
              key={slot.start}
              className="h-2 flex-1 rounded-[1px]"
              style={{
                backgroundColor: isDanger
                  ? 'var(--score-1)'
                  : (tier?.colorVar ?? UNAVAILABLE_COLOR_VAR),
              }}
            />
          );
        })}
      </div>

      <div className="mt-2 flex justify-between text-meta nums text-fg-faint" aria-hidden="true">
        {['00h', '03h', '06h', '09h', '12h', '15h', '18h', '21h', '24h'].map((label, index) => (
          <span key={label} className={index % 2 === 1 ? 'hidden sm:inline' : undefined}>
            {label}
          </span>
        ))}
      </div>

      <figcaption className="mt-4">
        <ul className="flex flex-wrap gap-x-5 gap-y-2 text-meta nums text-fg-muted">
          <li className="flex items-center gap-2">
            <span className="h-[2px] w-6 bg-score-3" aria-hidden="true" />
            Hauteur d’eau
          </li>
          <li className="flex items-center gap-2">
            <FishGlyph color="var(--score-3)" size={16} />
            Créneau favorable
          </li>
          <li className="flex items-center gap-2">
            <span className="flex gap-[2px]" aria-hidden="true">
              <FishGlyph color="var(--score-4)" size={16} />
              <FishGlyph color="var(--score-4)" size={16} />
            </span>
            Créneau excellent
          </li>
          <li className="flex items-center gap-2">
            <span
              className="h-3 w-4 rounded-[1px] border border-edge bg-surface-2"
              aria-hidden="true"
            />
            Nuit
          </li>
          <li className="flex items-center gap-2">
            <span className="flex h-3 w-6 items-center gap-[3px]" aria-hidden="true">
              <span className="h-2 flex-1 rounded-[1px] bg-score-2" />
              <span className="h-2 flex-1 rounded-[1px] bg-score-4" />
            </span>
            Score des 8 créneaux
          </li>
          {nowPct !== null && (
            <li className="flex items-center gap-2">
              <span
                className="h-3 w-4 border-l-2 border-dashed border-fg"
                aria-hidden="true"
              />
              Maintenant
            </li>
          )}
        </ul>

        {(day.sunrise || day.sunset) && (
          <p className="mt-3 text-meta nums text-fg-muted" data-numeric="">
            Lever {day.sunrise ? formatTime(new Date(day.sunrise), timeZone) : '—'} · coucher{' '}
            {day.sunset ? formatTime(new Date(day.sunset), timeZone) : '—'} (heure locale, calculé).
          </p>
        )}

        <p className="mt-3 max-w-prose text-body text-fg-muted">
          {summary}{' '}
          <strong className="font-600 text-fg">
            Ces créneaux décrivent des conditions, pas la présence du poisson.
          </strong>{' '}
          Un créneau excellent reste un créneau : la mer décide.
        </p>
      </figcaption>
    </figure>
  );
}
