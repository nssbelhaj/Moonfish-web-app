import Link from 'next/link';
import type { SpotSummary } from '@/lib/forecast';
import { formatMeasure } from '@/lib/score-display';
import { spotPath } from '@/lib/routes';
import { classifyWind, WIND_EXPOSURE_LABEL } from '@/lib/scoring';
import { formatDateTime } from '@/lib/time';
import { SPOT_TYPE_LABELS, TECHNIQUE_LABELS } from '@/data/spots';
import { ScoreBadge } from '@/components/score/ScoreBadge';
import { Card } from '@/components/ui/Card';
import { Tag } from '@/components/ui/Tag';

/**
 * Carte de spot.
 *
 * Les quatre mesures sont en liste libellé/valeur et non en grille deux
 * colonnes : à 375 px, une grille 2×2 fait passer « 25 km/h · vent de mer » sur
 * trois lignes et casse l'alignement vertical de toute la carte.
 *
 * La carte entière est cliquable via un lien étendu, mais l'ancre reste autour
 * du titre : le focus clavier atterrit sur un élément nommé, et la bague de
 * focus n'est jamais retirée.
 */
export function SpotCard({ summary }: { summary: SpotSummary }) {
  const { spot, current, nextGood } = summary;
  const conditions = current?.conditions;
  const danger = current?.score.safety.level === 'danger';

  const rows: [string, string][] = [
    [
      'Vent',
      conditions
        ? `${formatMeasure(conditions.windSpeedKmh, 'km/h')} de ${WIND_EXPOSURE_LABEL[
            classifyWind(conditions.windFromDeg, spot.facingDeg)
          ].replace('vent de ', '')}`
        : 'Indispo.',
    ],
    ['Houle', formatMeasure(conditions?.swellHeightM, 'm', 1)],
    ['Coefficient', current ? String(current.tide.coefficient) : 'Indispo.'],
    [
      'Prochaine fenêtre',
      nextGood ? formatDateTime(new Date(nextGood.start), spot.timezone) : 'Aucune sous 7 j',
    ],
  ];

  return (
    <Card interactive className="relative flex h-full flex-col p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-body font-semibold font-600">
            <Link href={spotPath(spot)} className="after:absolute after:inset-0 after:content-['']">
              {spot.name}
            </Link>
          </h3>
          <p className="text-meta text-fg-faint mt-1 nums">{spot.regionName}</p>
        </div>
        <ScoreBadge value={current?.score.value ?? null} muted={danger} />
      </div>

      {danger && (
        <p className="text-meta text-fg-faint mt-3 rounded-ctl bg-card px-2 py-1 nums text-fg">
          Danger — conditions non praticables
        </p>
      )}

      <dl className="mt-4 space-y-1.5 text-meta nums">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-3">
            <dt className="text-meta text-fg-faint shrink-0">{label}</dt>
            <dd className="truncate text-right text-fg-muted" data-numeric="">
              {value}
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-4 flex flex-wrap gap-2">
        <Tag>{SPOT_TYPE_LABELS[spot.type]}</Tag>
        {spot.techniques.slice(0, 2).map((technique) => (
          <Tag key={technique}>{TECHNIQUE_LABELS[technique]}</Tag>
        ))}
        {spot.techniques.length > 2 && <Tag>+{spot.techniques.length - 2}</Tag>}
      </div>
    </Card>
  );
}
