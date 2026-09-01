import type { TideEvent } from '@/data/schemas';
import { formatTime } from '@/lib/time';

/**
 * Courbe de marée du jour.
 *
 * Instrument, pas décoration (handoff §2.8) : grille et trait, aucun remplissage
 * dégradé, aucune animation. La courbe est une sinusoïde reconstruite entre les
 * extremums fournis — c'est l'approximation d'usage, et elle est suffisante
 * pour situer une fenêtre de pêche à un quart d'heure près.
 */
export function TideChart({
  events,
  timeZone,
  dayStart,
}: {
  events: readonly TideEvent[];
  timeZone: string;
  /** Minuit local, ISO. */
  dayStart: string;
}) {
  if (events.length < 2) {
    return (
      <p className="text-meta nums text-fg-faint">
        Marées indisponibles pour cette journée.
      </p>
    );
  }

  const width = 640;
  const height = 160;
  const padding = { top: 16, bottom: 28, left: 8, right: 8 };

  const start = new Date(dayStart).getTime();
  const end = start + 24 * 3_600_000;

  const heights = events.map((event) => event.heightM);
  const minH = Math.min(...heights);
  const maxH = Math.max(...heights);
  const span = Math.max(0.2, maxH - minH);

  const x = (time: number): number =>
    padding.left + ((time - start) / (end - start)) * (width - padding.left - padding.right);
  const y = (heightM: number): number =>
    padding.top + (1 - (heightM - minH) / span) * (height - padding.top - padding.bottom);

  // Interpolation cosinusoïdale entre extremums : c'est la forme réelle de
  // l'onde de marée, et elle évite les segments droits qui feraient croire
  // à une variation linéaire de la hauteur d'eau.
  const samples: string[] = [];
  const sorted = [...events].sort(
    (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime(),
  );

  for (let i = 0; i < sorted.length - 1; i += 1) {
    const from = sorted[i]!;
    const to = sorted[i + 1]!;
    const t0 = new Date(from.time).getTime();
    const t1 = new Date(to.time).getTime();

    for (let step = 0; step <= 12; step += 1) {
      const ratio = step / 12;
      const time = t0 + (t1 - t0) * ratio;
      const eased = (1 - Math.cos(Math.PI * ratio)) / 2;
      const heightM = from.heightM + (to.heightM - from.heightM) * eased;
      samples.push(`${x(time).toFixed(1)},${y(heightM).toFixed(1)}`);
    }
  }

  const visibleEvents = sorted.filter((event) => {
    const t = new Date(event.time).getTime();
    return t >= start && t <= end;
  });

  return (
    <figure>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Courbe de marée : ${visibleEvents
          .map(
            (event) =>
              `${event.type === 'high' ? 'pleine mer' : 'basse mer'} à ${formatTime(new Date(event.time), timeZone)}, ${event.heightM.toFixed(2).replace('.', ',')} mètres`,
          )
          .join(' ; ')}`}
      >
        {/* Grille horaire toutes les 6 h. */}
        {[0, 6, 12, 18, 24].map((hour) => {
          const px = x(start + hour * 3_600_000);
          return (
            <g key={hour}>
              <line
                x1={px}
                y1={padding.top}
                x2={px}
                y2={height - padding.bottom}
                stroke="var(--edge)"
                strokeWidth="1"
              />
              <text
                x={px}
                y={height - 8}
                textAnchor={hour === 0 ? 'start' : hour === 24 ? 'end' : 'middle'}
                fill="var(--fg-dim)"
                fontSize="11"
                fontFamily="var(--font-plex-mono), ui-monospace, monospace"
              >
                {String(hour % 24).padStart(2, '0')}h
              </text>
            </g>
          );
        })}

        <polyline
          points={samples.join(' ')}
          fill="none"
          stroke="var(--score-3)"
          strokeWidth="2"
          strokeLinejoin="round"
        />

        {visibleEvents.map((event) => {
          const px = x(new Date(event.time).getTime());
          const py = y(event.heightM);
          return (
            <g key={event.time}>
              <circle cx={px} cy={py} r="3.5" fill="var(--page)" stroke="var(--fg)" strokeWidth="1.5" />
              <text
                x={px}
                y={event.type === 'high' ? py - 9 : py + 16}
                textAnchor="middle"
                fill="var(--fg-muted)"
                fontSize="11"
                fontFamily="var(--font-plex-mono), ui-monospace, monospace"
              >
                {formatTime(new Date(event.time), timeZone)}
              </text>
            </g>
          );
        })}
      </svg>

      <figcaption className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-meta nums text-fg-muted">
        {visibleEvents.map((event) => (
          <span key={`legend-${event.time}`} data-numeric="">
            {event.type === 'high' ? 'PM' : 'BM'} {formatTime(new Date(event.time), timeZone)}
            {' · '}
            {event.heightM.toFixed(2).replace('.', ',')} m
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
