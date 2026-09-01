import type { ForecastDay } from '@/lib/forecast';
import type { TideEvent } from '@/data/schemas';
import { sampleTideCurve, tideBounds } from '@/lib/forecast/tide-curve';
import { ACTIVITY_LABELS, activityLevel, tierForOrNull } from '@/lib/score-display';
import { formatTime } from '@/lib/time';
import { UI_TEXT_PROPS, WATER_TEXT_PROPS } from './WaterValue';

/**
 * Deux cadres, un par largeur d'écran.
 *
 * Un SVG à `width: 100%` étire son viewBox : le cadre de 340 px du handoff,
 * affiché dans une colonne de 1 100 px, est agrandi 3,3 fois — les traits de
 * 1 px deviennent 3,3 px et le texte de 9,5 px monte à 31 px. C'est
 * exactement ce qui rendait le graphe « grossier » sur le web alors qu'il était
 * net sur mobile : ce n'était pas le dessin, c'était le facteur d'échelle.
 *
 * Le cadre large n'est donc pas le même dessin étiré, c'est un dessin PLUS
 * LARGE dans lequel les mêmes épaisseurs gardent leur valeur d'origine.
 */
const COMPACT = {
  W: 340,
  H: 190,
  top: 30,
  bottom: 116,
  band: 140,
  font: 9.5,
  /** Marge gauche réservée à l'axe des hauteurs. */
  gutter: 30,
  /**
   * Deux fenêtres seulement en mobile.
   *
   * Quatre pastilles de deux heures dans 340 px se recouvrent, et leurs quatre
   * libellés « 14:00–16:00 » se chevauchent au point d'être illisibles. Le
   * cadre étroit ne porte donc que les deux meilleures : c'est de toute façon
   * la question qu'on se pose sur un téléphone, au bord de l'eau.
   */
  maxWindows: 3,
  shortLabel: true,
} as const;

const WIDE = {
  W: 760,
  H: 296,
  top: 46,
  bottom: 196,
  band: 226,
  font: 11,
  gutter: 40,
  maxWindows: 5,
  shortLabel: false,
} as const;

type Frame = typeof COMPACT | typeof WIDE;

/** Le poisson du `FishGlyph`, en chemin, pour être posé dans un SVG parent. */
const FISH_PATHS = [
  'M2 6 C 5 1, 13 1, 17 6 C 13 11, 5 11, 2 6 Z',
  'M16.5 6 L 22 2 L 22 10 Z',
] as const;

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
 * Créneaux porteurs de la journée : au plus quatre, jamais moins de deux
 * poissons.
 *
 * Douze créneaux affichés côte à côte redevenaient un tableau. Ce qui intéresse
 * le pêcheur, ce n'est pas la note de chacune des douze tranches, c'est
 * lesquelles valent le déplacement — et s'il n'y en a aucune, la réponse est
 * « aucune », pas une rangée de créneaux médiocres.
 */
export interface CarryingWindow {
  start: string;
  end: string;
  /** Nombre de poissons : le meilleur palier atteint dans la fenêtre. */
  level: 1 | 2 | 3;
  /** Meilleur score de la fenêtre, pour la couleur. */
  value: number;
}

/**
 * Fenêtres porteuses de la journée.
 *
 * Deux choses à la fois :
 *
 *  — on ne garde que les créneaux qui portent au moins un poisson, c'est-à-dire
 *    le palier « Passable » ou mieux. Douze tranches côte à côte redevenaient un
 *    tableau ; les fenêtres, elles, se lisent d'un coup. Une journée sans rien
 *    de porteur le dit, plutôt que d'aligner des créneaux médiocres ;
 *
 *  — les tranches CONTIGUËS sont fusionnées. Deux créneaux de deux heures qui
 *    se suivent ne sont pas deux sorties, c'est une fenêtre de quatre heures.
 *    Les afficher séparément collait deux pastilles bord à bord et écrivait
 *    « 14–16h16–18h » sans espace : le découpage technique fuyait dans
 *    l'interface.
 */
export function carryingWindows(day: ForecastDay, max = 4): CarryingWindow[] {
  const carrying = day.slots
    .filter((slot) => slot.score.safety.level !== 'danger')
    .filter((slot) => activityLevel(slot.score.value) >= 1);

  const merged: CarryingWindow[] = [];
  for (const slot of carrying) {
    const level = activityLevel(slot.score.value) as 1 | 2 | 3;
    const value = slot.score.value ?? 0;
    const last = merged[merged.length - 1];

    // Fusion uniquement à niveau ÉGAL.
    //
    // Fusionner des niveaux différents faisait absorber les créneaux moyens
    // voisins par une fenêtre à trois poissons, et produisait une « fenêtre très
    // élevée » de dix-huit heures — c'est-à-dire plus rien de lisible, et une
    // affirmation fausse sur les heures avalées au passage.
    if (
      last &&
      last.level === level &&
      new Date(last.end).getTime() === new Date(slot.start).getTime()
    ) {
      last.end = slot.end;
      if (value > last.value) last.value = value;
      continue;
    }
    merged.push({ start: slot.start, end: slot.end, level, value });
  }

  return merged
    .sort((a, b) => b.value - a.value)
    .slice(0, max)
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
}

/**
 * La journée : hauteur d'eau, jour et nuit, et les créneaux porteurs.
 *
 * L'activité vit DANS le graphe, sous la courbe, sur le même axe de temps —
 * c'est tout l'intérêt : on voit d'un coup que la fenêtre tombe sur la
 * montante. En rangée séparée sous la figure, elle redevenait un tableau qu'il
 * fallait relire de gauche à droite pour le rapporter à la marée.
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
  const hasCarrying = carryingWindows(day, 1).length > 0;

  return (
    <figure className="surface p-[14px]">
      <figcaption className="flex items-baseline justify-between gap-3">
        <span className="card-title">La journée</span>
        {coefficient !== null && (
          <span className="water-value nums text-[13.5px]">coef. {coefficient}</span>
        )}
      </figcaption>

      <div className="mt-3 md:hidden">
        <ChartBody {...{ day, tideEvents, timeZone, now }} frame={COMPACT} />
      </div>
      <div className="mt-3 hidden md:block">
        <ChartBody {...{ day, tideEvents, timeZone, now }} frame={WIDE} />
      </div>

      {hasCarrying && (
        <ul className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
          {([3, 2, 1] as const).map((level) => (
            <li key={level} className="flex items-center gap-[5px] text-[11px] text-fg-muted">
              <span className="flex items-center gap-[2px]" aria-hidden="true">
                {Array.from({ length: level }, (_, i) => (
                  <svg key={i} width="11" height="6" viewBox="0 0 24 12" fill="var(--fg-muted)">
                    {FISH_PATHS.map((d) => (
                      <path key={d} d={d} />
                    ))}
                  </svg>
                ))}
              </span>
              {ACTIVITY_LABELS[level]}
            </li>
          ))}
        </ul>
      )}

      <p className="card-source mt-3">
        {!hasCarrying
          ? 'Aucun créneau porteur aujourd’hui : le score reste au palier le plus bas sur les douze tranches de deux heures.'
          : 'Le nombre de poissons est le palier du score, lu autrement. Marée, vent, houle, solunaire et lumière ; jamais une promesse de prise.'}
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

function ChartBody({
  day,
  tideEvents,
  timeZone,
  now,
  frame,
}: {
  day: ForecastDay;
  tideEvents: readonly TideEvent[];
  timeZone: string;
  now: string;
  frame: Frame;
}) {
  const { W, H, top, bottom, band, font, gutter, maxWindows, shortLabel } = frame;
  const carrying = carryingWindows(day, maxWindows);

  const startMs = new Date(day.date).getTime();
  const endMs = startMs + 24 * 3_600_000;
  const plotW = W - gutter;
  const x = (ms: number) => gutter + ((ms - startMs) / (endMs - startMs)) * plotW;
  const clampX = (v: number) => Math.max(gutter, Math.min(W, v));

  const relevant = tideEvents.filter((e) => {
    const t = new Date(e.time).getTime();
    return t >= startMs - 8 * 3_600_000 && t <= endMs + 8 * 3_600_000;
  });

  const bounds = tideBounds(relevant);
  const y = (h: number) =>
    bounds && bounds.max > bounds.min
      ? top + (1 - (h - bounds.min) / (bounds.max - bounds.min)) * (bottom - top)
      : (top + bottom) / 2;

  const samples = bounds
    ? sampleTideCurve(relevant, new Date(startMs), new Date(endMs), 144).map(
        (s) => [x(new Date(s.time).getTime()), y(s.heightM)] as [number, number],
      )
    : [];
  const curve = smooth(samples);
  const area = curve ? `${curve} L${W},${bottom} L${gutter},${bottom} Z` : '';

  const sunrise = day.sunrise ? clampX(x(new Date(day.sunrise).getTime())) : null;
  const sunset = day.sunset ? clampX(x(new Date(day.sunset).getTime())) : null;

  const nowMs = new Date(now).getTime();
  const nowX = nowMs >= startMs && nowMs < endMs ? x(nowMs) : null;

  const events = relevant.filter((e) => {
    const t = new Date(e.time).getTime();
    return t >= startMs && t <= endMs;
  });

  /**
   * Graduations de hauteur.
   *
   * Le graphe montrait une courbe SANS échelle : une forme dont on ne pouvait
   * lire aucune hauteur. Quatre repères suffisent — les extrêmes du jour et deux
   * intermédiaires — et ils portent leur valeur, sinon ce ne sont que des traits.
   */
  const ticks =
    bounds && bounds.max > bounds.min
      ? [0, 1 / 3, 2 / 3, 1].map((f) => bounds.min + f * (bounds.max - bounds.min))
      : [];

  const gradientId = `mf-eau-${W}`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--water)" stopOpacity="0.7" />
          <stop offset="1" stopColor="var(--water)" stopOpacity="0.08" />
        </linearGradient>
      </defs>

      {/* Ruban de nuit : deux régimes de lumière, pas deux instants. */}
      {sunrise !== null && sunset !== null && (
        <g fill="var(--fg)" opacity="0.06">
          <rect x={gutter} y={top - 8} width={Math.max(0, sunrise - gutter)} height={bottom - top + 8} />
          <rect x={sunset} y={top - 8} width={W - sunset} height={bottom - top + 8} />
        </g>
      )}

      <g>
        {ticks.map((h) => (
          <g key={h}>
            <line
              x1={gutter}
              y1={y(h)}
              x2={W}
              y2={y(h)}
              stroke="var(--edge)"
              strokeWidth="1"
              strokeDasharray="2 5"
              opacity="0.7"
            />
            <text
              x={gutter - 5}
              y={y(h) + font / 3}
              textAnchor="end"
              fontSize={font - 0.5}
              fill="var(--fg-muted)"
              opacity="0.85"
              {...UI_TEXT_PROPS}
            >
              {h.toFixed(1).replace('.', ',')}
            </text>
          </g>
        ))}
        <text
          x={gutter - 5}
          y={top - 10}
          textAnchor="end"
          fontSize={font - 0.5}
          fill="var(--fg-muted)"
          opacity="0.85"
          {...UI_TEXT_PROPS}
        >
          m
        </text>
      </g>

      {area && <path d={area} fill={`url(#${gradientId})`} />}
      {curve && (
        <path d={curve} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />
      )}

      {sunrise !== null && (
        <SunMark x={sunrise} top={top} bottom={bottom} font={font} label={`↑ ${formatTime(new Date(day.sunrise as string), timeZone)}`} />
      )}
      {sunset !== null && (
        <SunMark x={sunset} top={top} bottom={bottom} font={font} align="end" label={`↓ ${formatTime(new Date(day.sunset as string), timeZone)}`} />
      )}

      {events.map((event) => {
        const px = x(new Date(event.time).getTime());
        const py = y(event.heightM);
        const end = px > W - font * 5;
        const start = px < font * 5;
        return (
          <g key={event.time}>
            {/*
              Pleine mer en disque PLEIN, basse mer en anneau CREUX.
              Le site de référence les distingue en bleu et rouge ; nous ne
              pouvons pas, le rouge étant réservé à la sécurité et un rouge de
              catégorie l'affaiblirait. La forme porte donc le second canal, et
              elle a l'avantage de rester lisible en niveaux de gris.
            */}
            {event.type === 'high' ? (
              <circle cx={px} cy={py} r={font / 3.2} fill="var(--accent)" />
            ) : (
              <circle
                cx={px}
                cy={py}
                r={font / 3.2}
                fill="var(--card)"
                stroke="var(--accent)"
                strokeWidth="1.6"
              />
            )}
            <text
              x={end ? px - 3 : start ? px + 3 : px}
              y={event.type === 'high' ? py - font : py + font * 1.5}
              textAnchor={end ? 'end' : start ? 'start' : 'middle'}
              fontSize={font}
              {...WATER_TEXT_PROPS}
            >
              {event.type === 'high' ? 'PM' : 'BM'} {formatTime(new Date(event.time), timeZone)}
            </text>
          </g>
        );
      })}

      {nowX !== null && (
        <>
          <line x1={nowX} y1={top - 18} x2={nowX} y2={bottom} stroke="var(--fg)" strokeWidth="1.4" />
          <circle cx={nowX} cy={top - 18} r="3" fill="var(--fg)" />
        </>
      )}

      {/*
        Les créneaux porteurs, SOUS la courbe et sur le même axe : un aplat très
        doux pour la durée, les poissons au centre, l'heure dessous. Pas de
        contour — c'est une zone, pas un objet à cliquer.
      */}
      {carrying.map((window) => {
        const x1 = clampX(x(new Date(window.start).getTime()));
        const x2 = clampX(x(new Date(window.end).getTime()));
        const cx = (x1 + x2) / 2;
        const level = window.level;
        const color = tierForOrNull(window.value)?.colorVar ?? 'var(--edge-strong)';
        // Les poissons ne débordent jamais de leur pastille : à fenêtre étroite,
        // c'est le glyphe qui rétrécit, pas la pastille qui s'élargit.
        const fishW = Math.min(font * 1.5, (x2 - x1 - 8) / level);
        const totalW = level * fishW + (level - 1) * 2;

        return (
          <g key={window.start}>
            {/* Un simple liseré sous les poissons : la durée, sans l'encadrer. */}
            <line
              x1={x1}
              y1={band + font * 0.9}
              x2={x2}
              y2={band + font * 0.9}
              stroke={color}
              strokeWidth="2"
              strokeLinecap="round"
              opacity="0.45"
            />
            <g fill={color} transform={`translate(${cx - totalW / 2}, ${band - font * 0.32})`}>
              {Array.from({ length: level }, (_, i) => (
                <g key={i} transform={`translate(${i * (fishW + 2)}, 0) scale(${fishW / 24})`}>
                  {FISH_PATHS.map((d) => (
                    <path key={d} d={d} />
                  ))}
                </g>
              ))}
            </g>
            <text
              x={cx}
              y={band + font * 2.4}
              textAnchor="middle"
              fontSize={font - 0.5}
              fill="var(--fg-muted)"
              {...UI_TEXT_PROPS}
            >
              {shortLabel
                ? `${formatTime(new Date(window.start), timeZone).slice(0, 2)}–${formatTime(new Date(window.end), timeZone).slice(0, 2)}h`
                : `${formatTime(new Date(window.start), timeZone)}–${formatTime(new Date(window.end), timeZone)}`}
            </text>
          </g>
        );
      })}

      <g fontSize={font} fill="var(--fg-muted)" opacity="0.6" {...UI_TEXT_PROPS}>
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
  );
}

function SunMark({
  x,
  top,
  bottom,
  font,
  label,
  align = 'start',
}: {
  x: number;
  top: number;
  bottom: number;
  font: number;
  label: string;
  align?: 'start' | 'end';
}) {
  return (
    <g>
      <line
        x1={x}
        y1={top - 8}
        x2={x}
        y2={bottom}
        stroke="var(--edge-strong)"
        strokeWidth="1"
        strokeDasharray="1 3"
      />
      <text
        x={align === 'end' ? x - 4 : x + 4}
        y={top - 12}
        textAnchor={align}
        fontSize={font}
        fill="var(--fg-muted)"
        fontFamily="var(--font-archivo), Archivo, system-ui, sans-serif"
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {label}
      </text>
    </g>
  );
}
