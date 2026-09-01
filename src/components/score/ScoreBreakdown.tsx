import { UNAVAILABLE_COLOR_VAR, formatScore, tierForOrNull } from '@/lib/score-display';
import { FACTOR_LABELS, type ScoreFactor, type ScoreResult } from '@/lib/scoring';

/**
 * Détail du calcul, facteur par facteur.
 *
 * Le poids est affiché à côté du sous-score : sans lui, un 9/10 sur la lumière
 * paraît aussi important qu'un 9/10 sur la marée, alors qu'il pèse sept fois
 * moins. C'est cette colonne qui rend le score défendable.
 *
 * Facteur indisponible (D11) : la ligne reste, avec « —,— », « écarté du calcul »
 * et le poids NOMINAL barré à côté du poids effectif à 0 %. Retirer la ligne
 * donnerait un détail qui semble complet ; afficher un 0/10 inventerait une
 * mauvaise note. Les autres lignes montrent leur poids RENORMALISÉ, celui qui a
 * réellement servi : c'est le seul qui explique le total affiché.
 */
export function ScoreBreakdown({ score }: { score: ScoreResult }) {
  const factors = Object.keys(score.breakdown) as ScoreFactor[];
  const ordered = factors.sort(
    (a, b) => score.breakdown[b].nominalWeight - score.breakdown[a].nominalWeight,
  );

  return (
    <ul className="divide-y divide-edge">
      {ordered.map((factor) => {
        const entry = score.breakdown[factor];
        const tier = tierForOrNull(entry.score);
        const percent = Math.round(entry.weight * 100);
        const nominalPercent = Math.round(entry.nominalWeight * 100);
        const renormalised = entry.score !== null && percent !== nominalPercent;

        return (
          <li key={factor} className="py-4">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <h3 className="text-body font-semibold font-600">{FACTOR_LABELS[factor]}</h3>
              <p className="text-meta nums" data-numeric="">
                <span
                  style={{ color: tier ? tier.colorVar : 'var(--fg-faint)', fontWeight: 600 }}
                >
                  {formatScore(entry.score)}
                </span>
                {entry.score === null ? (
                  <span className="text-fg-faint">
                    /10 · écarté du calcul (pesait {nominalPercent} %)
                  </span>
                ) : renormalised ? (
                  <span className="text-fg-faint">
                    /10 · pèse {percent} % (au lieu de {nominalPercent} %)
                  </span>
                ) : (
                  <span className="text-fg-faint">/10 · pèse {percent} %</span>
                )}
              </p>
            </div>

            <p className="mt-1 text-meta nums text-fg-muted">{entry.note}</p>

            <div className="mt-2 h-1.5 w-full rounded-[1px] bg-edge" aria-hidden="true">
              <div
                className="h-full rounded-[1px]"
                style={{
                  width: entry.score === null ? '100%' : `${entry.score * 10}%`,
                  backgroundColor: tier ? tier.colorVar : UNAVAILABLE_COLOR_VAR,
                }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
