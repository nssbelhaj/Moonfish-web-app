import type { TideEvent } from '@/data/schemas';
import type { SpeciesActivity } from '@/lib/species/activity';
import { sampleTideCurve, tideBounds } from '@/lib/forecast/tide-curve';
import { tierForOrNull } from '@/lib/score-display';
import { formatTime } from '@/lib/time';
import { UI_TEXT_PROPS, WATER_TEXT_PROPS } from './WaterValue';

const W = 340;
const CURVE_TOP = 8;
const CURVE_BOTTOM = 74;
const ROW_H = 14;

/**
 * Les fenêtres d'activité, posées sur la MÊME courbe de marée que l'onglet Live.
 *
 * C'est tout l'intérêt de l'écran (D3) : l'unité d'information n'est pas
 * l'espèce, c'est la FENÊTRE. L'indice sert à trier, la fenêtre à décider. En
 * réutilisant le tracé du Live, le pêcheur n'a qu'une seule lecture à apprendre
 * pour toute l'application.
 */
export function SpeciesWindowChart({
  activities,
  tideEvents,
  dayStart,
  timeZone,
  now,
}: {
  activities: readonly SpeciesActivity[];
  tideEvents: readonly TideEvent[];
  dayStart: string;
  timeZone: string;
  now: string;
}) {
  const startMs = new Date(dayStart).getTime();
  const endMs = startMs + 24 * 3_600_000;
  const x = (ms: number) => ((ms - startMs) / (endMs - startMs)) * W;

  const relevant = tideEvents.filter((e) => {
    const t = new Date(e.time).getTime();
    return t >= startMs - 8 * 3_600_000 && t <= endMs + 8 * 3_600_000;
  });
  const bounds = tideBounds(relevant);
  const y = (h: number) =>
    bounds && bounds.max > bounds.min
      ? CURVE_TOP + (1 - (h - bounds.min) / (bounds.max - bounds.min)) * (CURVE_BOTTOM - CURVE_TOP)
      : (CURVE_TOP + CURVE_BOTTOM) / 2;

  const pts = bounds
    ? sampleTideCurve(relevant, new Date(startMs), new Date(endMs), 72).map(
        (s) => `${x(new Date(s.time).getTime()).toFixed(1)},${y(s.heightM).toFixed(1)}`,
      )
    : [];
  const curve = pts.length ? `M${pts.join(' L')}` : '';
  const area = curve ? `${curve} L${W},${CURVE_BOTTOM} L0,${CURVE_BOTTOM} Z` : '';

  const highs = relevant.filter((e) => e.type === 'high');
  const shown = activities.filter((a) => a.index !== null).slice(0, 3);
  const H = CURVE_BOTTOM + 12 + shown.length * ROW_H;

  const nowMs = new Date(now).getTime();
  const nowX = nowMs >= startMs && nowMs < endMs ? x(nowMs) : null;

  /** Fenêtre d'une espèce, en pixels, autour de chaque pleine mer de la journée. */
  function bars(activity: SpeciesActivity): { x1: number; x2: number }[] {
    const { fromH, toH } = activity.species.window;
    return highs
      .map((h) => {
        const pm = new Date(h.time).getTime();
        return { x1: x(pm + fromH * 3_600_000), x2: x(pm + toH * 3_600_000) };
      })
      .map((b) => ({ x1: Math.max(0, b.x1), x2: Math.min(W, b.x2) }))
      .filter((b) => b.x2 - b.x1 > 2);
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" aria-hidden="true">
      <defs>
        <linearGradient id="mf-eau-sp" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--water)" stopOpacity="0.8" />
          <stop offset="1" stopColor="var(--water)" stopOpacity="0.15" />
        </linearGradient>
      </defs>

      <g stroke="var(--edge)" strokeDasharray="3 4">
        <line x1="0" y1="20" x2={W} y2="20" />
        <line x1="0" y1="48" x2={W} y2="48" />
      </g>

      {area && <path d={area} fill="url(#mf-eau-sp)" />}
      {curve && <path d={curve} fill="none" stroke="var(--accent)" strokeWidth="1.8" />}

      {relevant
        .filter((e) => {
          const t = new Date(e.time).getTime();
          return t >= startMs && t <= endMs;
        })
        .map((event) => {
          const px = x(new Date(event.time).getTime());
          const anchorEnd = px > W - 56;
          return (
            <text
              key={event.time}
              x={anchorEnd ? px - 3 : px + 3}
              y="14"
              textAnchor={anchorEnd ? 'end' : 'start'}
              fontSize="9.5"
              {...WATER_TEXT_PROPS}
            >
              {event.type === 'high' ? 'PM' : 'BM'} {formatTime(new Date(event.time), timeZone)}
            </text>
          );
        })}

      {nowX !== null && (
        <>
          <line x1={nowX} y1="4" x2={nowX} y2={CURVE_BOTTOM} stroke="var(--fg)" strokeWidth="1.4" />
          <circle cx={nowX} cy={y(bounds ? (bounds.max + bounds.min) / 2 : 0)} r="3.4" fill="var(--fg)" />
        </>
      )}

      <g fontSize="9.5" {...UI_TEXT_PROPS}>
        {shown.map((activity, index) => {
          const rowY = CURVE_BOTTOM + 16 + index * ROW_H;
          const color = tierForOrNull(activity.index)?.colorVar ?? 'var(--edge-strong)';
          return (
            <g key={activity.species.slug}>
              <text x="0" y={rowY + 6} fill="var(--fg-muted)">
                {activity.species.name}
              </text>
              {bars(activity).map((b) => (
                <rect
                  key={`${activity.species.slug}-${b.x1}`}
                  x={Math.max(62, b.x1)}
                  y={rowY}
                  width={Math.max(4, b.x2 - Math.max(62, b.x1))}
                  height="8"
                  rx="4"
                  fill={color}
                  fillOpacity="0.85"
                />
              ))}
            </g>
          );
        })}
      </g>
    </svg>
  );
}
