import { formatScore, tierFor } from '@/lib/score-display';
import { ScoreShape } from './ScoreShape';

/**
 * Score compact, pour les cartes de liste.
 * Porte les quatre canaux : chiffre, libellé, forme et couleur.
 */
export function ScoreBadge({
  value,
  muted = false,
}: {
  value: number | null;
  /** Conditions dangereuses : le badge perd son accent, comme la réglette. */
  muted?: boolean;
}) {
  if (value === null) {
    return (
      <span className="inline-flex items-center gap-2 rounded-tag bg-card-raised px-2.5 py-1">
        <span className="font-mono text-score-md text-fg-dim" data-numeric="">
          —,—
        </span>
        <span className="meta font-mono">Indispo.</span>
      </span>
    );
  }

  const tier = tierFor(value);
  const color = muted ? 'var(--fg-muted)' : tier.colorVar;

  // En danger, le badge perd son accent (handoff §3). L'atténuation passe par la
  // COULEUR et non par une opacité globale : `opacity` s'applique aussi au
  // libellé et le faisait tomber à 3,7:1, sous le seuil AA que le handoff §1
  // garantit par ailleurs. Seule la forme, décorative, est vraiment estompée.
  return (
    <span className="inline-flex items-center gap-2">
      <ScoreShape tier={tier} size={14} className={muted ? 'opacity-50' : undefined} />
      <span className="font-mono text-score-md" style={{ color, fontWeight: 600 }} data-numeric="">
        {formatScore(value)}
      </span>
      <span className="meta font-mono">
        {tier.label}
      </span>
    </span>
  );
}
