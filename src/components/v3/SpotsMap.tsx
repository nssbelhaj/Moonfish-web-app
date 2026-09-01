import Link from 'next/link';
import type { SpotSummary } from '@/lib/forecast';
import {
  MARKER_SHAPES,
  MARKER_SHAPE_LABELS,
  projectSpots,
  spreadMarkers,
  viewHeightFor,
} from '@/lib/map/projection';
import { formatScore, tierForOrNull } from '@/lib/score-display';
import { spotPath } from '@/lib/routes';
import { WATER_TEXT_PROPS } from './WaterValue';

const W = 390;
/** Rayon des pastilles, et distance minimale entre deux centres. */
const R = 16;

/**
 * Carte des spots — fond DESSINÉ, jamais une tuile satellite (D7).
 *
 * Une photo aérienne rendrait les repères de sonde illisibles et, surtout,
 * ferait croire à une carte de navigation. Le fond est donc un aplat de bandes
 * de sonde et d'isobathes stylisés.
 *
 * ─────────────────────────────────────────────────────────────────────────
 *  CE QUE CETTE CARTE DIT, ET CE QU'ELLE NE DIT PAS.
 *
 *  Les POSITIONS des spots sont réelles : latitude et longitude projetées.
 *  Le FOND ne l'est pas. Les maquettes dessinaient un trait de côte ; nous
 *  n'avons aucune donnée de littoral, et en inventer un placerait des spots du
 *  mauvais côté d'un rivage imaginaire — sur un produit dont tout l'argument
 *  est l'honnêteté des données, ce serait le pire endroit où mentir. Les
 *  bandes de sonde sont donc explicitement décoratives, et la légende le dit.
 * ─────────────────────────────────────────────────────────────────────────
 */
export function SpotsMap({ summaries }: { summaries: readonly SpotSummary[] }) {
  const spots = summaries.map((s) => s.spot);
  const H = viewHeightFor(spots, W);
  const view = { width: W, height: H, padding: R + 8 };
  const points = spreadMarkers(projectSpots(spots, view), R * 2 + 4, view);

  return (
    <div className="surface overflow-hidden p-0">
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img"
        aria-label={`Carte de repérage de ${summaries.length} spots. La liste complète suit sous la carte.`}>
        <defs>
          <linearGradient id="mf-sonde" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="var(--water)" stopOpacity="0.55" />
            <stop offset="1" stopColor="var(--water)" stopOpacity="0.16" />
          </linearGradient>
        </defs>

        <rect x="0" y="0" width={W} height={H} fill="url(#mf-sonde)" />

        {/* Isobathes stylisées : des repères de profondeur, pas un relevé. */}
        <g stroke="var(--water)" fill="none" strokeDasharray="4 5" strokeWidth="1" opacity="0.9">
          {[0.2, 0.45, 0.72].map((f) => (
            <path
              key={f}
              d={`M-10,${(H * f).toFixed(0)} C90,${(H * f - 20).toFixed(0)} 200,${(H * f + 26).toFixed(0)} 400,${(H * f - 4).toFixed(0)}`}
            />
          ))}
        </g>
        <g fontSize="10" {...WATER_TEXT_PROPS} opacity="0.85">
          <text x="8" y={H * 0.2 - 6}>−5 m</text>
          <text x="8" y={H * 0.45 - 6}>−10 m</text>
          <text x="8" y={H * 0.72 - 6}>−20 m</text>
        </g>

        {points.map(({ spot, x, y }) => {
          const summary = summaries.find((s) => s.spot.slug === spot.slug);
          const value = summary?.current?.score.value ?? null;
          const danger = summary?.current?.score.safety.level === 'danger';
          const tier = tierForOrNull(value);
          const fill = danger ? 'var(--danger)' : (tier?.colorVar ?? 'var(--edge-strong)');
          const shape = MARKER_SHAPES[spot.type];
          const r = R;

          return (
            <g key={spot.slug}>
              {shape === 'cercle' && (
                <>
                  <circle cx={x} cy={y} r={r} fill={fill} />
                  <circle cx={x} cy={y} r={r} fill="none" stroke="var(--page)" strokeWidth="2" />
                </>
              )}
              {shape === 'carre' && (
                <>
                  <rect x={x - r} y={y - r} width={r * 2} height={r * 2} rx="6" fill={fill} />
                  <rect x={x - r} y={y - r} width={r * 2} height={r * 2} rx="6" fill="none" stroke="var(--page)" strokeWidth="2" />
                </>
              )}
              {shape === 'triangle' && (
                <>
                  <path d={`M${x},${y - r - 2} L${x + r + 1},${y + r - 3} L${x - r - 1},${y + r - 3} Z`} fill={fill} />
                  <path d={`M${x},${y - r - 2} L${x + r + 1},${y + r - 3} L${x - r - 1},${y + r - 3} Z`} fill="none" stroke="var(--page)" strokeWidth="2" />
                </>
              )}
              <text
                x={x}
                y={y + (shape === 'triangle' ? 9 : 5)}
                textAnchor="middle"
                fontSize="12"
                fontWeight="700"
                fill="var(--card)"
                fontFamily="var(--font-archivo), Archivo, system-ui, sans-serif"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {formatScore(value)}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="border-t border-edge p-[14px]">
        <p className="text-[11px] text-fg-muted">
          <strong className="font-semibold text-fg">Non destinée à la navigation.</strong> Les
          positions des spots sont réelles ; le fond, les bandes de sonde et les isobathes sont
          dessinés et ne relèvent d’aucun levé hydrographique. Pour naviguer, utilisez une carte
          marine officielle.
        </p>
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-fg-muted">
          {(['cercle', 'carre', 'triangle'] as const).map((shape) => (
            <li key={shape}>
              {MARKER_SHAPE_LABELS[shape]} ={' '}
              {shape === 'cercle' ? 'plage ou estran' : shape === 'carre' ? 'estuaire' : 'pointe ou digue'}
            </li>
          ))}
        </ul>
      </div>

      {/* La carte est décorative pour un lecteur d'écran : la liste porte l'information. */}
      <ul className="border-t border-edge">
        {summaries.map((summary) => {
          const value = summary.current?.score.value ?? null;
          const tier = tierForOrNull(value);
          return (
            <li key={summary.spot.slug} className="border-b border-surface-2 last:border-0">
              <Link
                href={spotPath(summary.spot)}
                className="flex min-h-tap items-center justify-between gap-3 px-[14px] py-3 tappable"
              >
                <span className="flex flex-col">
                  <span className="font-serif text-[17px] font-semibold">{summary.spot.name}</span>
                  <span className="text-meta text-fg-muted">{summary.spot.regionName}</span>
                </span>
                <span className="flex items-center gap-3">
                  <span className="font-serif text-[13px]" style={{ color: tier?.colorVar ?? 'var(--fg-muted)' }}>
                    {tier?.label ?? 'Indispo.'}
                  </span>
                  <span
                    className="nums text-[19px] font-bold"
                    style={{ color: tier?.colorVar ?? 'var(--fg-muted)' }}
                    data-numeric=""
                  >
                    {formatScore(value)}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
