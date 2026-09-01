import type { ForecastDay } from '@/lib/forecast';
import type { TideEvent } from '@/data/schemas';
import { sampleTideCurve, tideBounds } from '@/lib/forecast/tide-curve';
import { ACTIVITY_LABELS, activityLevel, tierForOrNull } from '@/lib/score-display';
import { formatTime } from '@/lib/time';
import { FishGlyph } from '@/components/marine/FishGlyph';
import { UI_TEXT_PROPS, WATER_TEXT_PROPS } from './WaterValue';

/** Cadre du handoff : 340 de large, texte SVG jamais sous 9,5 px. */
const W = 340;
const CURVE_TOP = 30;
const CURVE_BOTTOM = 118;
/**
 * Hauteur totale. L'écart entre le bas de la courbe et l'axe des heures n'est
 * pas décoratif : les libellés de BASSE MER se posent sous leur point, or ce
 * point touche le bas du tracé. Sans cette réserve, « BM 10:16 » se superposait
 * à la ligne de base et aux heures.
 *
 * Il n'y a d'ailleurs plus de ligne de base tracée : le bord inférieur de
 * l'aplat d'eau la dessine déjà, et le trait supplémentaire ne faisait que
 * barrer les libellés de basse mer.
 */
const H = 156;

function smooth(points: readonly [number, number][]): string {
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
    d.push(
      `C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`,
    );
  }
  return d.join(' ');
}

/**
 * La journée : hauteur d'eau, jour et nuit, et l'activité par créneau de 2 h.
 *
 * ─────────────────────────────────────────────────────────────────────────
 *  CE QUI A CHANGÉ, ET POURQUOI.
 *
 *  Le graphe portait une « bande d'activité » continue, lissée sous la marée.
 *  Deux défauts : elle suggérait une mesure continue là où nous n'avons que
 *  douze notes discrètes, et elle empilait deux courbes dans la même hauteur,
 *  ce qui rendait les deux illisibles.
 *
 *  L'activité est donc désormais une RANGÉE DE CRÉNEAUX de deux heures, chacun
 *  codé de zéro à trois poissons. Ce n'est pas une seconde information à
 *  apprendre : le nombre de poissons EST le palier du score, lu autrement.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Le ruban jour/nuit est en fond plutôt qu'en ligne : le lever et le coucher ne
 * sont pas des événements ponctuels comme une pleine mer, ce sont des bornes
 * entre deux régimes de lumière — et c'est ce que le pêcheur lit.
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
  const clampX = (v: number) => Math.max(0, Math.min(W, v));

  const relevant = tideEvents.filter((e) => {
    const t = new Date(e.time).getTime();
    return t >= startMs - 8 * 3_600_000 && t <= endMs + 8 * 3_600_000;
  });

  const bounds = tideBounds(relevant);
  const y = (h: number) =>
    bounds && bounds.max > bounds.min
      ? CURVE_TOP + (1 - (h - bounds.min) / (bounds.max - bounds.min)) * (CURVE_BOTTOM - CURVE_TOP)
      : (CURVE_TOP + CURVE_BOTTOM) / 2;

  const samples = bounds
    ? sampleTideCurve(relevant, new Date(startMs), new Date(endMs), 120).map(
        (s) => [x(new Date(s.time).getTime()), y(s.heightM)] as [number, number],
      )
    : [];
  const curve = smooth(samples);
  const area = curve ? `${curve} L${W},${CURVE_BOTTOM} L0,${CURVE_BOTTOM} Z` : '';

  const sunrise = day.sunrise ? clampX(x(new Date(day.sunrise).getTime())) : null;
  const sunset = day.sunset ? clampX(x(new Date(day.sunset).getTime())) : null;

  const nowMs = new Date(now).getTime();
  const nowX = nowMs >= startMs && nowMs < endMs ? x(nowMs) : null;

  const events = relevant.filter((e) => {
    const t = new Date(e.time).getTime();
    return t >= startMs && t <= endMs;
  });

  return (
    <figure className="surface p-[14px]">
      <figcaption className="flex items-baseline justify-between gap-3">
        <span className="card-title">La journée</span>
        {coefficient !== null && (
          <span className="water-value nums text-[13.5px]">coef. {coefficient}</span>
        )}
      </figcaption>

      <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 block h-auto w-full" aria-hidden="true">
        <defs>
          <linearGradient id="mf-eau" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--water)" stopOpacity="0.7" />
            <stop offset="1" stopColor="var(--water)" stopOpacity="0.08" />
          </linearGradient>
        </defs>

        {/* Ruban de nuit, en fond : deux régimes de lumière, pas deux instants. */}
        {sunrise !== null && sunset !== null && (
          <g fill="var(--fg)" opacity="0.06">
            <rect x="0" y={CURVE_TOP - 8} width={sunrise} height={CURVE_BOTTOM - CURVE_TOP + 8} />
            <rect
              x={sunset}
              y={CURVE_TOP - 8}
              width={W - sunset}
              height={CURVE_BOTTOM - CURVE_TOP + 8}
            />
          </g>
        )}

        {/* Deux repères seulement : trois lignes encombraient un cadre de 100 px. */}
        <g stroke="var(--edge)" strokeWidth="1" strokeDasharray="2 5" opacity="0.7">
          <line x1="0" y1={CURVE_TOP + 26} x2={W} y2={CURVE_TOP + 26} />
          <line x1="0" y1={CURVE_TOP + 68} x2={W} y2={CURVE_TOP + 68} />
        </g>

        {area && <path d={area} fill="url(#mf-eau)" />}
        {curve && (
          <path
            d={curve}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="2"
            strokeLinecap="round"
          />
        )}

        {/* Lever et coucher : un trait fin et sobre, la mention au-dessus. */}
        {sunrise !== null && (
          <g>
            <line
              x1={sunrise}
              y1={CURVE_TOP - 8}
              x2={sunrise}
              y2={CURVE_BOTTOM}
              stroke="var(--edge-strong)"
              strokeWidth="1"
              strokeDasharray="1 3"
            />
            <text x={sunrise + 4} y={CURVE_TOP - 12} fontSize="9.5" fill="var(--fg-muted)" {...UI_TEXT_PROPS}>
              ↑ {formatTime(new Date(day.sunrise as string), timeZone)}
            </text>
          </g>
        )}
        {sunset !== null && (
          <g>
            <line
              x1={sunset}
              y1={CURVE_TOP - 8}
              x2={sunset}
              y2={CURVE_BOTTOM}
              stroke="var(--edge-strong)"
              strokeWidth="1"
              strokeDasharray="1 3"
            />
            <text
              x={sunset - 4}
              y={CURVE_TOP - 12}
              textAnchor="end"
              fontSize="9.5"
              fill="var(--fg-muted)"
              {...UI_TEXT_PROPS}
            >
              ↓ {formatTime(new Date(day.sunset as string), timeZone)}
            </text>
          </g>
        )}

        {/* Extrêmes : un point sur le tracé, l'heure dessous en grandeur d'eau. */}
        {events.map((event) => {
          const px = x(new Date(event.time).getTime());
          const py = y(event.heightM);
          const anchorEnd = px > W - 46;
          const anchorStart = px < 46;
          return (
            <g key={event.time}>
              <circle cx={px} cy={py} r="2.6" fill="var(--accent)" />
              <text
                x={anchorEnd ? px - 3 : anchorStart ? px + 3 : px}
                y={event.type === 'high' ? py - 9 : py + 14}
                textAnchor={anchorEnd ? 'end' : anchorStart ? 'start' : 'middle'}
                fontSize="9.5"
                {...WATER_TEXT_PROPS}
              >
                {event.type === 'high' ? 'PM' : 'BM'} {formatTime(new Date(event.time), timeZone)}
              </text>
            </g>
          );
        })}

        {nowX !== null && (
          <>
            <line
              x1={nowX}
              y1={CURVE_TOP - 18}
              x2={nowX}
              y2={CURVE_BOTTOM}
              stroke="var(--fg)"
              strokeWidth="1.4"
            />
            <circle cx={nowX} cy={CURVE_TOP - 18} r="3" fill="var(--fg)" />
          </>
        )}


        <g fontSize="9.5" fill="var(--fg-muted)" {...UI_TEXT_PROPS}>
          {[0, 6, 12, 18, 24].map((hour) => (
            <text
              key={hour}
              x={clampX((hour / 24) * W)}
              y={H - 2}
              textAnchor={hour === 0 ? 'start' : hour === 24 ? 'end' : 'middle'}
            >
              {hour === 24 ? '24h' : `${String(hour).padStart(2, '0')}h`}
            </text>
          ))}
        </g>
      </svg>

      {/* L'activité, hors du SVG : douze créneaux de 2 h codés en poissons. */}
      <ul className="mt-3 grid grid-cols-6 gap-[3px]" aria-hidden="true">
        {day.slots.map((slot) => {
          const danger = slot.score.safety.level === 'danger';
          // Un créneau dangereux ne porte AUCUN poisson, quel que soit son score.
          // Des poissons en rouge se liraient comme une activité intense ; or le
          // rouge appartient à la sécurité, et ce créneau n'est pas pêchable.
          const level = danger ? 0 : activityLevel(slot.score.value);
          const tier = tierForOrNull(slot.score.value);
          const color = danger ? 'var(--danger)' : (tier?.colorVar ?? 'var(--edge-strong)');
          const isNow = new Date(slot.start).getTime() <= nowMs && new Date(slot.end).getTime() > nowMs;

          return (
            <li
              key={slot.start}
              className={`flex flex-col items-center gap-1 rounded-[6px] py-[5px] ${isNow ? 'bg-surface-2' : ''}`}
            >
              <span className="text-[9.5px] nums text-fg-muted" data-numeric="">
                {formatTime(new Date(slot.start), timeZone).slice(0, 2)}
              </span>
              <span className="flex h-[10px] items-center gap-[2px]">
                {level === 0 ? (
                  <span
                    className={`block rounded-full ${danger ? 'h-[3px] w-4' : 'h-[2px] w-3'}`}
                    style={{ backgroundColor: color }}
                  />
                ) : (
                  Array.from({ length: level }, (_, i) => (
                    <FishGlyph key={i} color={color} size={8} />
                  ))
                )}
              </span>
            </li>
          );
        })}
      </ul>

      <p className="card-source mt-3">
        Un à trois poissons = le palier du score, lu autrement. Aucun poisson : activité faible,
        ou créneau dangereux — le trait passe alors au rouge de la sécurité. Marée, vent, houle,
        solunaire et lumière ; jamais une promesse de prise.
      </p>

      <p className="sr-only">
        {day.slots
          .map(
            (slot) =>
              `${formatTime(new Date(slot.start), timeZone)} : ${
                slot.score.safety.level === 'danger'
                  ? 'créneau dangereux'
                  : ACTIVITY_LABELS[activityLevel(slot.score.value)]
              }`,
          )
          .join('. ')}
        .
      </p>
    </figure>
  );
}
