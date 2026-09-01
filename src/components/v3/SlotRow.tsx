import type { ForecastSlot } from '@/lib/forecast';
import { formatScore, tierForOrNull } from '@/lib/score-display';
import { formatTime } from '@/lib/time';

/**
 * Un créneau est une LIGNE, pas une vignette (D2).
 *
 * On lit un horaire de haut en bas ; une grille de vignettes fait perdre l'ordre
 * chronologique dès qu'elle passe à deux colonnes en mobile. Trois colonnes
 * fixes — heure, jauge, score — pour que l'œil descende en ligne droite.
 */
export function SlotRow({
  slot,
  timeZone,
  active = false,
  last = false,
}: {
  slot: ForecastSlot;
  timeZone: string;
  /** Créneau en cours : fond appuyé et graisse renforcée. */
  active?: boolean;
  last?: boolean;
}) {
  const tier = tierForOrNull(slot.score.value);
  const danger = slot.score.safety.level === 'danger';
  const color = danger ? 'var(--danger)' : (tier?.colorVar ?? 'var(--edge-strong)');
  const width = slot.score.value === null ? 0 : slot.score.value * 10;

  return (
    <div
      className={[
        'grid grid-cols-[76px_1fr_46px] items-center gap-[10px] py-[10px]',
        last ? '' : 'border-b border-surface-2',
        active ? '-mx-[14px] bg-page px-[14px]' : '',
      ].join(' ')}
    >
      <span
        className={`text-body nums ${active ? 'font-semibold' : 'text-fg-muted'}`}
        data-numeric=""
      >
        {formatTime(new Date(slot.start), timeZone)} – {formatTime(new Date(slot.end), timeZone)}
      </span>

      <span className="flex items-center gap-2">
        <span className="relative h-[6px] flex-1 rounded-[3px] bg-surface-2">
          <i
            className="absolute inset-y-0 left-0 rounded-[3px]"
            style={{ width: `${width}%`, backgroundColor: color }}
          />
        </span>
        <span
          className={`font-serif text-[13px] ${active ? 'font-semibold' : ''}`}
          style={{ color }}
        >
          {danger ? 'Danger' : (tier?.label ?? 'Indispo.')}
        </span>
      </span>

      <span className="text-right text-[19px] font-bold nums" style={{ color }} data-numeric="">
        {formatScore(slot.score.value)}
      </span>
    </div>
  );
}
