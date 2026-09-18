import Link from 'next/link';

import type { Moment } from '@/lib/forecast/moments';
import { spotPath } from '@/lib/routes';
import { formatMeasure, formatScore, tierForOrNull } from '@/lib/score-display';
import { classifyWind, WIND_EXPOSURE_LABEL } from '@/lib/scoring';
import { formatTime } from '@/lib/time';

/**
 * Un créneau nommé : « ce soir, 19 h – 21 h, à Gravelines ».
 *
 * La carte répond à une question de pêcheur, pas à une question de classement.
 * L'heure et le lieu viennent donc AVANT le score : c'est la phrase qu'on
 * lit, le score n'est que sa justification.
 */
export function CarteMoment({ moment }: { moment: Moment }) {
  const { spot, slot, titre } = moment;
  const tier = tierForOrNull(slot.score.value);
  const debut = formatTime(new Date(slot.start), spot.timezone);
  const fin = formatTime(new Date(slot.end), spot.timezone);

  return (
    <article className="relative flex h-full flex-col rounded-card border border-edge bg-card p-4">
      <p className="text-meta nums text-fg-faint" data-numeric="">
        {titre}
      </p>

      <h3 className="mt-1 font-serif text-h2 font-semibold">
        <Link href={spotPath(spot)} className="after:absolute after:inset-0 after:content-['']">
          {spot.name}
        </Link>
      </h3>

      <p className="mt-1 text-meta nums text-fg-muted" data-numeric="">
        {spot.regionName} · {debut} – {fin}
      </p>

      <div className="mt-4 flex items-baseline gap-2">
        <span
          className="nums font-serif text-score-md"
          style={{ color: tier ? tier.colorVar : 'var(--fg-muted)' }}
          data-numeric=""
        >
          {formatScore(slot.score.value)}
        </span>
        <span className="text-meta nums text-fg-faint" data-numeric="">
          /10 · {tier ? tier.label : 'indisponible'}
        </span>
      </div>

      <p className="mt-3 text-meta nums text-fg-muted" data-numeric="">
        {slot.conditions
          ? `Vent ${formatMeasure(slot.conditions.windSpeedKmh, 'km/h')} de ${WIND_EXPOSURE_LABEL[
              classifyWind(slot.conditions.windFromDeg, spot.facingDeg)
            ].replace('vent de ', '')}, houle ${formatMeasure(slot.conditions.swellHeightM, 'm', 1)}`
          : 'Conditions marines indisponibles sur ce créneau.'}
        {slot.tide ? ` · coefficient ${slot.tide.coefficient}` : ''}
      </p>
    </article>
  );
}
