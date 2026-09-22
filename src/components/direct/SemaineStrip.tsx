import Link from 'next/link';

import type { JourDeSemaine } from '@/lib/forecast/pays';
import { ancreDuJour } from '@/lib/forecast/pays';
import { formatScore, tierForOrNull } from '@/lib/score-display';
import { formatDayNumber, formatWeekdayShort } from '@/lib/time';

/**
 * Sept jours, sept tuiles : le meilleur score de chaque journée.
 *
 * C'est la frise que tout site de prévision met sous ses conditions du
 * moment — on y lit en une seconde si le week-end vaut le déplacement. Chaque
 * tuile mène au jour correspondant de la page de prévision du spot.
 *
 * Un jour entièrement dangereux se lit « danger », en toutes lettres, jamais
 * comme un mauvais score : la sécurité ne se dérive pas du score.
 */
export function SemaineStrip({
  jours,
  hrefPrevision,
  timeZone,
}: {
  jours: readonly JourDeSemaine[];
  /** `/spots/…/prevision`, sans ancre. */
  hrefPrevision: string;
  timeZone: string;
}) {
  if (jours.length === 0) return null;

  return (
    <ol className="grid grid-cols-7 gap-1">
      {jours.map((jour) => {
        const date = new Date(jour.date);
        const tier = tierForOrNull(jour.meilleur);
        return (
          <li key={jour.date}>
            <Link
              href={`${hrefPrevision}#${ancreDuJour(jour.date, timeZone)}`}
              className="tappable flex min-h-[64px] flex-col items-center justify-center rounded-inner bg-surface-2 px-1 py-2 hover:bg-edge"
              aria-label={`${formatWeekdayShort(date, timeZone)} ${formatDayNumber(date, timeZone)} : ${
                jour.danger ? 'conditions dangereuses' : `meilleur score ${formatScore(jour.meilleur)} sur 10`
              }`}
            >
              <span className="text-src uppercase tracking-wide text-fg-muted">
                {formatWeekdayShort(date, timeZone)}
              </span>
              <span className="nums text-meta font-600 text-fg" data-numeric="">
                {formatDayNumber(date, timeZone)}
              </span>
              <span
                className="mt-1 nums text-val-sm"
                style={{ color: jour.danger ? 'var(--danger)' : (tier?.colorVar ?? 'var(--fg-muted)') }}
                data-numeric=""
              >
                {jour.danger ? '!' : formatScore(jour.meilleur)}
              </span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
