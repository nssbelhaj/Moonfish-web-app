import type { ScoreResult } from '@/lib/scoring';
import { formatScore, tierForOrNull } from '@/lib/score-display';
import { CompassMark } from './CompassMark';
import { ScoreScale } from './ScoreScale';

/**
 * Cartouche de score (R1, R2, R8).
 *
 * Le chiffre est le plus grand élément de l'écran. Il se lit sur trois canaux
 * avant la couleur : le chiffre lui-même, le libellé de palier en Spectral, et
 * la position sur l'échelle 0–10 graduée. La rose des vents en filigrane est le
 * SEUL endroit où elle apparaît.
 *
 * Score absent : « —,— », « Indispo. », échelle éteinte. Jamais 0, jamais une
 * carte masquée (R13) — un score manquant n'est pas un mauvais score.
 */
export function ScoreCartouche({
  score,
  title,
  meta,
  eyebrow,
  size = 'lg',
}: {
  score: ScoreResult;
  /** Nom du spot ou du créneau, en Spectral. */
  title: string;
  /** Ligne secondaire : distance, état de marée, coefficient. */
  meta?: React.ReactNode;
  /** Sur-titre discret : « Le plus proche de vous · maintenant ». */
  eyebrow?: string;
  size?: 'lg' | 'md';
}) {
  const tier = tierForOrNull(score.value);
  const danger = score.safety.level === 'danger';
  const color = danger ? 'var(--fg-muted)' : (tier?.colorVar ?? 'var(--fg-muted)');

  return (
    <div className="surface relative overflow-hidden p-[15px]">
      <CompassMark />

      {eyebrow && <p className="relative text-[11.5px] text-fg-muted">{eyebrow}</p>}

      <div className="relative mt-2 flex items-end justify-between gap-3">
        <div className="flex flex-col gap-[3px]">
          <p className="font-serif text-[20px] font-semibold leading-tight">{title}</p>
          {meta && <p className="text-meta text-fg-muted">{meta}</p>}
        </div>

        <div className="shrink-0 text-right">
          <p
            className={`nums font-bold leading-none ${size === 'lg' ? 'text-[44px]' : 'text-score-sm'}`}
            style={{ color }}
            data-numeric=""
          >
            {formatScore(score.value)}
          </p>
          <p className="font-serif text-[14px] font-semibold" style={{ color }}>
            {danger ? 'Danger' : (tier?.label ?? 'Indispo.')}
          </p>
        </div>
      </div>

      <div className="relative mt-3">
        <ScoreScale value={danger ? null : score.value} />
      </div>
    </div>
  );
}
