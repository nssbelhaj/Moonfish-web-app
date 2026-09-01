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
 * Carte de spot : score courant, prochaine bonne fenêtre, marée, vent.
 *
 * La carte entière est cliquable via un lien étendu, mais le lien reste un vrai
 * `<a>` autour du titre : le focus clavier atterrit sur un élément nommé, et la
 * bague de focus n'est jamais retirée (handoff §1).
 */
export function SpotCard({ summary }: { summary: SpotSummary }) {
  const { spot, current, nextGood } = summary;
  const conditions = current?.conditions;
  const danger = current?.score.safety.level === 'danger';

  return (
    <Card className="relative flex h-full flex-col p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-h3 font-600">
            <Link href={spotPath(spot)} className="after:absolute after:inset-0 after:content-['']">
              {spot.name}
            </Link>
          </h3>
          <p className="mt-1 font-mono text-data text-fg-muted">{spot.regionName}</p>
        </div>
        <ScoreBadge value={current?.score.value ?? null} muted={danger} />
      </div>

      {danger && (
        <p className="mt-3 rounded-tag bg-alert-bg px-2 py-1 font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-alert-ink">
          Danger — conditions non praticables
        </p>
      )}

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 font-mono text-data">
        <div>
          <dt className="text-[0.6875rem] uppercase tracking-[0.14em] text-fg-dim">Vent</dt>
          <dd className="mt-0.5 text-fg-muted" data-numeric="">
            {conditions
              ? `${formatMeasure(conditions.windSpeedKmh, 'km/h')} · ${WIND_EXPOSURE_LABEL[classifyWind(conditions.windFromDeg, spot.facingDeg)]}`
              : 'Indispo.'}
          </dd>
        </div>
        <div>
          <dt className="text-[0.6875rem] uppercase tracking-[0.14em] text-fg-dim">Houle</dt>
          <dd className="mt-0.5 text-fg-muted" data-numeric="">
            {formatMeasure(conditions?.swellHeightM, 'm', 1)}
          </dd>
        </div>
        <div>
          <dt className="text-[0.6875rem] uppercase tracking-[0.14em] text-fg-dim">Coefficient</dt>
          <dd className="mt-0.5 text-fg-muted" data-numeric="">
            {current ? current.tide.coefficient : 'Indispo.'}
          </dd>
        </div>
        <div>
          <dt className="text-[0.6875rem] uppercase tracking-[0.14em] text-fg-dim">
            Prochaine fenêtre
          </dt>
          <dd className="mt-0.5 text-fg-muted" data-numeric="">
            {nextGood ? formatDateTime(new Date(nextGood.start), spot.timezone) : 'Aucune sous 7 j'}
          </dd>
        </div>
      </dl>

      <div className="mt-4 flex flex-wrap gap-2">
        <Tag>{SPOT_TYPE_LABELS[spot.type]}</Tag>
        {/* Deux techniques au plus : la carte doit rester lisible à 375 px. */}
        {spot.techniques.slice(0, 2).map((technique) => (
          <Tag key={technique}>{TECHNIQUE_LABELS[technique]}</Tag>
        ))}
        {spot.techniques.length > 2 && <Tag>+{spot.techniques.length - 2}</Tag>}
      </div>
    </Card>
  );
}
