import { formatScore, litNotches, tierForOrNull } from '@/lib/score-display';
import type { ScoreResult } from '@/lib/scoring';
import { ScoreShape } from './ScoreShape';

/**
 * Réglette de score à 10 crans.
 *
 * Graduation DROITE et non arc (handoff §5) : le nombre de crans allumés se lit
 * d'un œil, à contre-jour, sans lire le chiffre. Le cran suivant reste éteint —
 * 8,4 allume 8 crans — pour ne jamais flatter visuellement le score.
 *
 * En conditions dangereuses, la réglette perd son accent et passe à 50 %
 * d'opacité : le score reste consultable mais cesse d'être une invitation.
 *
 * Score absent (D11) : « —,— », « Indispo. » et réglette entièrement éteinte.
 * Jamais 0,0 et jamais un palier : un score manquant n'est pas un mauvais score,
 * et emprunter la couleur du palier bas reviendrait à affirmer des conditions
 * qu'on n'a pas mesurées.
 */
export function ScoreGauge({
  score,
  size = 'lg',
}: {
  score: ScoreResult;
  size?: 'lg' | 'md';
}) {
  const tier = tierForOrNull(score.value);
  const lit = score.value === null ? 0 : litNotches(score.value);
  const isDanger = score.safety.level === 'danger';
  const color =
    tier === null ? 'var(--fg-faint)' : isDanger ? 'var(--fg-muted)' : tier.colorVar;

  // Handoff §3 : en danger, la jauge « passe à opacity .5 et perd sa couleur
  // d'accent ». Appliquée au bloc entier, cette opacité fait passer le chiffre
  // et le libellé sous 4,5:1 — en contradiction avec la garantie AA du §1. On
  // garde donc l'intention (accent retiré, jauge visiblement éteinte) en
  // n'estompant que les éléments décoratifs : la réglette et la forme.
  return (
    <div>
      <div className="flex items-end gap-3">
        <p
          className={`nums font-700 ${size === 'lg' ? 'text-score' : 'text-score-sm'}`}
          style={{ color, fontWeight: 700 }}
          data-numeric=""
        >
          {formatScore(score.value)}
          <span className="text-body font-semibold font-500 text-fg-faint"> /10</span>
        </p>
      </div>

      <div className="mt-3 flex items-center gap-2">
        {tier && (
          <ScoreShape tier={tier} size={16} className={isDanger ? 'opacity-50' : undefined} />
        )}
        <p className="text-meta text-fg-faint nums">
          {tier ? tier.label : 'Indispo.'}
        </p>
      </div>

      {/* La réglette elle-même. Décorative : le score chiffré la précède déjà. */}
      <div className={`mt-3 flex gap-1 ${isDanger ? 'opacity-50' : ''}`} aria-hidden="true">
        {Array.from({ length: 10 }, (_, index) => (
          <span
            key={index}
            className="h-6 flex-1 rounded-[1px]"
            style={{
              backgroundColor: index < lit ? color : 'var(--edge)',
            }}
          />
        ))}
      </div>
    </div>
  );
}
