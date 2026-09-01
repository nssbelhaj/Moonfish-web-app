import type { ForecastDay } from '@/lib/forecast';
import type { TideEvent } from '@/data/schemas';
import { sampleTideCurve, tideBounds } from '@/lib/forecast/tide-curve';
import { favourableSlots } from '@/lib/forecast/slots';
import { tierForOrNull } from '@/lib/score-display';
import { formatTime } from '@/lib/time';
import { UI_TEXT_PROPS, WATER_TEXT_PROPS } from './WaterValue';

/** Cadre du handoff : 340 × 180, texte SVG jamais sous 9,5 px. */
const W = 340;
const H = 180;
/** Bande de marée en haut, bande d'activité en bas. */
const TIDE_TOP = 12;
const TIDE_BOTTOM = 110;
const ACT_TOP = 118;

function catmullRom(points: readonly [number, number][]): string {
  if (points.length < 2) return '';
  const d: string[] = [`M${points[0]![0].toFixed(1)},${points[0]![1].toFixed(1)}`];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d.push(`C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`);
  }
  return d.join(' ');
}

/**
 * Marée et activité, en un seul tracé annoté (R5, R6).
 *
 * Pas d'histogramme, pas d'axe encadré : une courbe de marée pleine avec
 * dégradé d'eau vertical, des lignes de repère pointillées, la ligne
 * « maintenant » en encre, et les annotations POSÉES SUR le tracé plutôt que
 * renvoyées à une légende. La bande d'activité, en bas, reprend la même lecture
 * — le dégradé s'éteint vers le haut et les maxima portent leur heure.
 *
 * Les deux courbes partagent le même axe de temps, ce qui est tout l'intérêt :
 * on voit d'un coup que la fenêtre d'activité tombe sur la montante.
 */
export function TideActivityChart({
  day,
  tideEvents,
  timeZone,
  now,
  coefficient,
}: {
  day: ForecastDay;
  tideEvents: readonly TideEvent[];
  timeZone: string;
  now: string;
  coefficient: number | null;
}) {
  const startMs = new Date(day.date).getTime();
  const endMs = startMs + 24 * 3_600_000;
  const x = (ms: number) => ((ms - startMs) / (endMs - startMs)) * W;

  const relevant = tideEvents.filter((e) => {
    const t = new Date(e.time).getTime();
    return t >= startMs - 8 * 3_600_000 && t <= endMs + 8 * 3_600_000;
  });

  const bounds = tideBounds(relevant);
  const y = (h: number) =>
    bounds && bounds.max > bounds.min
      ? TIDE_TOP + (1 - (h - bounds.min) / (bounds.max - bounds.min)) * (TIDE_BOTTOM - TIDE_TOP)
      : (TIDE_TOP + TIDE_BOTTOM) / 2;

  const samples = bounds
    ? sampleTideCurve(relevant, new Date(startMs), new Date(endMs), 96).map(
        (s) => [x(new Date(s.time).getTime()), y(s.heightM)] as [number, number],
      )
    : [];
  const tidePath = catmullRom(samples);
  const tideArea = tidePath ? `${tidePath} L${W},${TIDE_BOTTOM} L0,${TIDE_BOTTOM} Z` : '';

  // Bande d'activité : le score des huit créneaux, lissé sur le même axe.
  const actPoints: [number, number][] = day.slots.map((slot) => {
    const mid = new Date(slot.start).getTime() + 1.5 * 3_600_000;
    const v = slot.score.value ?? 0;
    return [x(mid), H - 4 - (v / 10) * (H - ACT_TOP - 8)];
  });
  const actPath = catmullRom(actPoints);
  const actArea = actPath ? `${actPath} L${W},${H} L0,${H} Z` : '';

  const best = favourableSlots(day.slots).slice(0, 2);
  const bestTier = tierForOrNull(best[0]?.score.value ?? null);
  const actColor = bestTier?.colorVar ?? 'var(--accent)';

  const nowMs = new Date(now).getTime();
  const nowX = nowMs >= startMs && nowMs < endMs ? x(nowMs) : null;

  const events = relevant.filter((e) => {
    const t = new Date(e.time).getTime();
    return t >= startMs && t <= endMs;
  });

  return (
    <figure className="surface p-[14px]">
      <figcaption className="flex items-baseline justify-between gap-3">
        <span className="card-title">Marée et activité</span>
        {coefficient !== null && <span className="water-value text-[13.5px]">coef. {coefficient}</span>}
      </figcaption>

      <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 block h-auto w-full" aria-hidden="true">
        <defs>
          <linearGradient id="mf-eau" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--water)" stopOpacity="0.85" />
            <stop offset="1" stopColor="var(--water)" stopOpacity="0.18" />
          </linearGradient>
          <linearGradient id="mf-act" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={actColor} stopOpacity="0.05" />
            <stop offset="1" stopColor={actColor} stopOpacity="0.55" />
          </linearGradient>
        </defs>

        {/* Repères pointillés, jamais un axe encadré. */}
        <g stroke="var(--edge)" strokeWidth="1" strokeDasharray="3 4">
          <line x1="0" y1="26" x2={W} y2="26" />
          <line x1="0" y1="62" x2={W} y2="62" />
          <line x1="0" y1="98" x2={W} y2="98" />
        </g>

        {tideArea && <path d={tideArea} fill="url(#mf-eau)" />}
        {tidePath && <path d={tidePath} fill="none" stroke="var(--accent)" strokeWidth="1.8" />}

        {actArea && <path d={actArea} fill="url(#mf-act)" />}
        {actPath && <path d={actPath} fill="none" stroke={actColor} strokeWidth="1.5" />}

        {/* Maxima d'activité : point plein, ligne d'attache pointillée, heure. */}
        {best.map((slot) => {
          const mid = new Date(slot.start).getTime() + 1.5 * 3_600_000;
          const px = x(mid);
          const py = H - 4 - ((slot.score.value ?? 0) / 10) * (H - ACT_TOP - 8);
          const anchorEnd = px > W - 60;
          return (
            <g key={slot.start}>
              <line x1={px} y1={py} x2={px} y2={py + 16} stroke={actColor} strokeWidth="1" strokeDasharray="2 3" />
              <circle cx={px} cy={py} r="3.2" fill={actColor} />
              <text
                x={anchorEnd ? px - 6 : px + 6}
                y={py - 2}
                textAnchor={anchorEnd ? 'end' : 'start'}
                fontSize="9.5"
                fill={actColor}
                {...UI_TEXT_PROPS}
              >
                {formatTime(new Date(slot.start), timeZone)}
              </text>
            </g>
          );
        })}

        {/* Annotations de marée, posées sur le tracé, en grandeur d'eau. */}
        {events.map((event) => {
          const px = x(new Date(event.time).getTime());
          const py = y(event.heightM);
          const anchorEnd = px > W - 80;
          return (
            <text
              key={event.time}
              x={anchorEnd ? px - 4 : px + 4}
              y={event.type === 'high' ? py - 7 : py + 14}
              textAnchor={anchorEnd ? 'end' : 'start'}
              fontSize="10"
              {...WATER_TEXT_PROPS}
            >
              {event.type === 'high' ? 'PM' : 'BM'} {formatTime(new Date(event.time), timeZone)} ·{' '}
              {event.heightM.toFixed(2).replace('.', ',')} m
            </text>
          );
        })}

        {nowX !== null && (
          <>
            <line x1={nowX} y1="6" x2={nowX} y2={TIDE_BOTTOM} stroke="var(--fg)" strokeWidth="1.4" />
            <circle cx={nowX} cy={y(bounds ? (bounds.max + bounds.min) / 2 : 0)} r="3.4" fill="var(--fg)" />
            <text
              x={nowX > W - 90 ? nowX - 5 : nowX + 5}
              y="32"
              textAnchor={nowX > W - 90 ? 'end' : 'start'}
              fontSize="9.5"
              fill="var(--fg)"
              {...UI_TEXT_PROPS}
            >
              maintenant {formatTime(new Date(now), timeZone)}
            </text>
          </>
        )}
      </svg>

      <p className="sr-only">
        Courbe de marée et bande d’activité sur la journée.{' '}
        {best.length === 0
          ? 'Aucun créneau favorable.'
          : `Créneaux favorables : ${best
              .map((s) => formatTime(new Date(s.start), timeZone))
              .join(', ')}.`}
      </p>
    </figure>
  );
}
