import type { MarinePoint } from '@/data/schemas';
import { compassPoint, waveHeights } from '@/lib/forecast/wave-statistics';
import { formatMeasure } from '@/lib/score-display';
import { WaterValue } from './WaterValue';

/**
 * État de mer : la houle avec sa DISTRIBUTION, pas une seule hauteur.
 *
 * « Houle 0,6 m » laisse croire que les vagues font 0,6 m. C'est faux : la
 * hauteur significative est déjà la moyenne du plus grand tiers, et une vague
 * sur trois mille en fait le double. Le pêcheur qui décide d'aller sur des
 * roches a besoin de la MAXIMALE, pas de la moyenne — c'est elle qui le
 * renverse.
 *
 * Les trois hauteurs sont DÉRIVÉES de la significative par la loi de Rayleigh,
 * pas mesurées ; la mention de source le dit.
 */
export function SeaStateCard({ conditions }: { conditions: MarinePoint }) {
  const h = waveHeights(conditions.swellHeightM, conditions.swellPeriodS);

  return (
    <section aria-labelledby="etat-mer" className="surface p-[14px]">
      <h2 id="etat-mer" className="card-title">
        État de mer
      </h2>

      <dl className="mt-3 grid grid-cols-3 gap-3">
        {[
          ['Direction', `${compassPoint(conditions.swellFromDeg)} (${Math.round(conditions.swellFromDeg)}°)`],
          ['Hauteur', formatMeasure(conditions.swellHeightM, 'm', 2)],
          ['Période', formatMeasure(conditions.swellPeriodS, 's', 1)],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="text-[11px] text-fg-muted">{label}</dt>
            <dd className="mt-0.5">
              <WaterValue className="nums text-[15px]">{value}</WaterValue>
            </dd>
          </div>
        ))}
      </dl>

      <ul className="mt-4 space-y-2">
        <li className="flex items-baseline gap-3">
          <WaterValue className="nums w-[52px] shrink-0 text-[15px]">
            {formatMeasure(h.frequentM, 'm', 2)}
          </WaterValue>
          <span className="text-body text-fg-muted">
            <span className="font-semibold text-fg">la plus fréquente</span> — ce que l’œil voit la
            plupart du temps.
          </span>
        </li>
        <li className="flex items-baseline gap-3">
          <WaterValue className="nums w-[52px] shrink-0 text-[15px]">
            {formatMeasure(h.significantM, 'm', 2)}
          </WaterValue>
          <span className="text-body text-fg-muted">
            <span className="font-semibold text-fg">significative</span> — la hauteur annoncée par
            les modèles. Environ <span className="nums">{h.exceedingSignificantPct} %</span> des
            vagues la dépassent, soit une sur sept.
          </span>
        </li>
        {h.maxM !== null && (
          <li className="flex items-baseline gap-3">
            <WaterValue className="nums w-[52px] shrink-0 text-[15px]">
              {formatMeasure(h.maxM, 'm', 2)}
            </WaterValue>
            <span className="text-body text-fg-muted">
              <span className="font-semibold text-fg">maximale attendue</span> sur vingt-quatre
              heures. Ce n’est pas un plafond : une vague plus grosse reste possible.
            </span>
          </li>
        )}
      </ul>

      <p className="card-source mt-3">
        Hauteurs la plus fréquente et maximale DÉDUITES de la significative par la loi de Rayleigh,
        non mesurées. Le seuil de danger de Moonfish porte sur la significative : à{' '}
        <span className="nums">2,50 m</span> annoncés, attendez-vous à des vagues de{' '}
        <span className="nums">5 m</span>.
      </p>
    </section>
  );
}
