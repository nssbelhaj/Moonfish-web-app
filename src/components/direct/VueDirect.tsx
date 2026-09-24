import Link from 'next/link';

import { ScoreCartouche } from '@/components/v3/ScoreCartouche';
import type { ResumePays } from '@/lib/forecast/pays';
import { spotPath } from '@/lib/routes';
import { formatMeasure } from '@/lib/score-display';
import { classifyWind, WIND_EXPOSURE_LABEL } from '@/lib/scoring';

import { CourbeMaree } from './CourbeMaree';
import { SemaineStrip } from './SemaineStrip';

const ETAT_MAREE = { rising: 'montante', falling: 'descendante', slack: 'étale' } as const;

/**
 * Le direct d'un pays : son meilleur spot maintenant, sa marée, sa semaine.
 *
 * C'est le bloc qui remplace le discours d'accueil. Un site de conditions
 * montre des conditions — pas un paragraphe qui promet d'en montrer. Le
 * cartouche, la courbe et la semaine sont trois lectures de la même donnée,
 * de la plus rapide (un chiffre) à la plus riche (une courbe).
 */
export function VueDirect({ resume, now }: { resume: ResumePays; now: Date }) {
  const { meilleur, pays } = resume;

  if (meilleur === null || meilleur.current === null) {
    return (
      <div className="surface p-4">
        <p className="text-body font-600">Aucun score calculable pour l’instant — {pays.nom}.</p>
        <p className="mt-2 max-w-prose text-body text-fg-muted">
          Soit tous les spots sont en conditions dangereuses, soit les fournisseurs n’ont
          rien rendu. La page de chaque spot dit lequel des deux.
        </p>
      </div>
    );
  }

  const { spot, current } = meilleur;
  const c = current.conditions;
  const meta = [
    spot.regionName,
    current.tide ? `marée ${ETAT_MAREE[current.tide.state]}, coef. ${current.tide.coefficient}` : null,
    c
      ? `vent ${formatMeasure(c.windSpeedKmh, 'km/h')} de ${WIND_EXPOSURE_LABEL[
          classifyWind(c.windFromDeg, spot.facingDeg)
        ].replace('vent de ', '')}`
      : null,
  ]
    .filter((m): m is string => m !== null)
    .join(' · ');

  return (
    <div className="flex flex-col gap-3">
      <ScoreCartouche
        score={current.score}
        title={spot.name}
        eyebrow={`Meilleur maintenant · ${pays.nom}`}
        meta={meta}
      />

      <div className="surface p-[14px]">
        <CourbeMaree events={meilleur.tideEvents} now={now} timeZone={spot.timezone} />
        <p className="card-source mt-2">
          Marée à {spot.name} — {meilleur.sources.tide.source.name}
          {meilleur.sources.tide.source.kind === 'simulated' ? ' (simulée)' : ''}.
        </p>
      </div>

      <div className="surface p-[14px]">
        <p className="card-title">Les sept prochains jours</p>
        <div className="mt-3">
          <SemaineStrip
            jours={resume.semaine}
            hrefPrevision={`${spotPath(spot)}/prevision`}
            timeZone={spot.timezone}
          />
        </div>
        <p className="card-source mt-3 flex items-baseline justify-between gap-3">
          <span>Le meilleur créneau de chaque jour, hors danger.</span>
          <Link href={spotPath(spot)} className="shrink-0 text-fg underline decoration-dotted underline-offset-4">
            Ouvrir {spot.name}
          </Link>
        </p>
      </div>
    </div>
  );
}
