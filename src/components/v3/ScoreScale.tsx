import { tierForOrNull } from '@/lib/score-display';

/**
 * Échelle 0–10 graduée (R2, troisième canal).
 *
 * Le score se lit sur trois canaux avant la couleur : le chiffre, le libellé de
 * palier, et la POSITION sur cette échelle. Le repère vertical en encre marque
 * la valeur exacte : la barre remplie seule se lit comme une proportion, le
 * repère la rend ponctuelle — c'est ce qui permet de comparer deux créneaux
 * d'un coup d'œil sans lire les chiffres.
 */
export function ScoreScale({ value }: { value: number | null }) {
  const tier = tierForOrNull(value);
  const pct = value === null ? 0 : Math.max(0, Math.min(100, value * 10));

  return (
    <div className="flex flex-col gap-[5px]">
      <div className="relative h-[7px] rounded-[4px] bg-surface-2">
        {value !== null && (
          <>
            <div
              className="absolute inset-y-0 left-0 rounded-[4px]"
              style={{ width: `${pct}%`, backgroundColor: tier?.colorVar }}
            />
            <div
              className="absolute -top-1 h-[15px] w-[2px]"
              style={{ left: `${pct}%`, backgroundColor: 'var(--fg)' }}
            />
          </>
        )}
      </div>
      <div className="flex justify-between text-[10.5px] nums text-fg-muted" aria-hidden="true">
        <span>0</span>
        <span>5</span>
        <span>10</span>
      </div>
    </div>
  );
}
