import { tierFor } from '@/lib/score-display';
import { FACTOR_LABELS, type ScoreFactor, type ScoreResult } from '@/lib/scoring';

/**
 * Détail du calcul, facteur par facteur.
 *
 * Le poids est affiché à côté du sous-score : sans lui, un 9/10 sur la lumière
 * paraît aussi important qu'un 9/10 sur la marée, alors qu'il pèse sept fois
 * moins. C'est cette colonne qui rend le score défendable.
 */
export function ScoreBreakdown({ score }: { score: ScoreResult }) {
  const factors = Object.keys(score.breakdown) as ScoreFactor[];
  const ordered = factors.sort((a, b) => score.breakdown[b].weight - score.breakdown[a].weight);

  return (
    <ul className="divide-y divide-edge">
      {ordered.map((factor) => {
        const entry = score.breakdown[factor];
        const tier = tierFor(entry.score);
        const percent = Math.round(entry.weight * 100);

        return (
          <li key={factor} className="py-4">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <h3 className="text-h3 font-600">{FACTOR_LABELS[factor]}</h3>
              <p className="font-mono text-data" data-numeric="">
                <span style={{ color: tier.colorVar, fontWeight: 600 }}>
                  {entry.score.toFixed(1).replace('.', ',')}
                </span>
                <span className="text-fg-dim">/10 · pèse {percent} %</span>
              </p>
            </div>

            <p className="mt-1 font-mono text-data text-fg-muted">{entry.note}</p>

            <div className="mt-2 h-1.5 w-full rounded-[1px] bg-edge" aria-hidden="true">
              <div
                className="h-full rounded-[1px]"
                style={{ width: `${entry.score * 10}%`, backgroundColor: tier.colorVar }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
