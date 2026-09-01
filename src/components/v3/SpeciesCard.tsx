import { MAILLE_REFERENCE, MAILLE_SOURCE_URL, type Sea } from '@/data/species';
import type { SpeciesActivity } from '@/lib/species/activity';
import { formatScore, tierForOrNull } from '@/lib/score-display';
import { ScoreScale } from './ScoreScale';

/**
 * Une espèce, avec sa fenêtre, son montage et sa RÉGLEMENTATION (D5).
 *
 * La maille et la limite journalière ne sont pas un détail juridique posé en
 * bas de page : elles sont dans la carte, à côté du montage. Un montage sans sa
 * réglementation est une invitation à l'infraction.
 *
 * Quand nous n'avons pas vérifié la maille, la carte le DIT et renvoie à
 * l'arrêté. Elle n'invente pas un chiffre, et elle ne masque pas non plus
 * l'espèce : les deux tromperaient, dans des sens opposés.
 */
export function SpeciesCard({
  activity,
  sea,
  expanded = false,
}: {
  activity: SpeciesActivity;
  sea: Sea;
  /** La première espèce est dépliée : score en grand, échelle 0–10, latin. */
  expanded?: boolean;
}) {
  const tier = tierForOrNull(activity.index);
  const color = tier?.colorVar ?? 'var(--edge-strong)';
  const maille = activity.species.maille[sea];
  const width = activity.index === null ? 0 : activity.index * 10;

  return (
    <article className="surface flex flex-col gap-3 p-[14px]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-[3px]">
          <h3 className={`font-serif font-semibold ${expanded ? 'text-[22px]' : 'text-[19px]'}`}>
            {activity.species.name}
          </h3>
          {expanded ? (
            <p className="font-serif text-[13px] italic text-fg-muted">{activity.species.latin}</p>
          ) : (
            <p className="text-meta text-fg-muted">{activity.window}</p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-[10px]">
          <span className="font-serif text-[13px]" style={{ color }}>
            {activity.label ?? 'Indispo.'}
          </span>
          <span
            className={`nums font-bold leading-none ${expanded ? 'text-[34px]' : 'text-[26px]'}`}
            style={{ color }}
            data-numeric=""
          >
            {formatScore(activity.index)}
          </span>
        </div>
      </div>

      {expanded ? (
        <ScoreScale value={activity.index} />
      ) : (
        <div className="relative h-[6px] rounded-[3px] bg-surface-2">
          <div
            className="absolute inset-y-0 left-0 rounded-[3px]"
            style={{ width: `${width}%`, backgroundColor: color }}
          />
        </div>
      )}

      {expanded && <p className="text-meta text-fg-muted">{activity.window}</p>}

      <p className="text-body text-fg-muted">{activity.note}</p>

      <p className="card-source">
        {maille === null ? (
          <>
            Maille non vérifiée dans nos données pour cette façade — consultez{' '}
            <a
              href={MAILLE_SOURCE_URL}
              className="underline decoration-dotted underline-offset-4"
              rel="noopener noreferrer"
              target="_blank"
            >
              l’arrêté en vigueur
            </a>{' '}
            avant de garder une prise.
          </>
        ) : (
          <>
            Maille <span className="nums">{maille} cm</span>
            {activity.species.dailyLimit ? ` · ${activity.species.dailyLimit}` : ''} ·{' '}
            {MAILLE_REFERENCE}
          </>
        )}
      </p>
    </article>
  );
}
