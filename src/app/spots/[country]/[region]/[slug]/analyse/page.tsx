import type { Metadata } from 'next';
import Link from 'next/link';

import { EmailCaptureForm } from '@/components/forms/EmailCaptureForm';
import { ScoreBreakdown } from '@/components/score/ScoreBreakdown';
import { DemoDataNotice } from '@/components/data/DemoDataNotice';
import { SpotTabs } from '@/components/spot/SpotTabs';
import {
  BOTTOM_LABELS,
  EXPOSURE_LABELS,
  SPOT_TYPE_LABELS,
  TECHNIQUE_DESCRIPTIONS,
  TECHNIQUE_LABELS,
} from '@/data/spots';
import { absoluteUrl, spotPath } from '@/lib/routes';
import { findSpot, resolveSpot, type RouteParams } from '../spot-page-data';

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}): Promise<Metadata> {
  const spot = await findSpot(params);
  if (!spot) return { title: 'Spot introuvable' };

  const techniques = spot.techniques.map((technique) => TECHNIQUE_LABELS[technique]).join(', ');

  return {
    title: `${spot.name} : techniques, espèces et accès`,
    description: `Ce qui se pratique à ${spot.name} : ${techniques.toLowerCase()}. Espèces cibles, nature du fond, accès et détail du calcul du score.`,
    alternates: { canonical: absoluteUrl(`${spotPath(spot)}/analyse`) },
  };
}

export default async function SpotAnalysisPage({ params }: { params: Promise<RouteParams> }) {
  const { spot, forecast } = await resolveSpot(params);
  const current = forecast.current;

  return (
    <>
      <div className="mx-auto w-full max-w-shell px-4 pt-6 md:px-8">
        <SpotTabs basePath={spotPath(spot)} active="analyse" />

        <div className="mt-6">
          <DemoDataNotice sources={Object.values(forecast.sources)} />
        </div>
      </div>

      <div className="mx-auto w-full max-w-shell px-4 py-8 md:px-8 md:py-12 xl:grid xl:grid-cols-[1fr_400px] xl:gap-12">
        <div>
          <section aria-labelledby="detail">
            <h2 id="detail" className="text-h2 font-600">
              Le détail du calcul
            </h2>
            <p className="mt-2 max-w-measure text-body text-fg-muted">
              Chaque facteur est noté sur 10, puis pondéré. Le poids est affiché : sans lui, un bon
              score de lumière paraîtrait aussi décisif qu’un bon score de marée, alors qu’il pèse
              sept fois moins.
            </p>
            {current ? (
              <div className="mt-6">
                <ScoreBreakdown score={current.score} />
              </div>
            ) : (
              <p className="mt-4 font-mono text-data text-fg-dim">
                Aucun créneau à analyser pour l’instant.
              </p>
            )}
            <p className="mt-4 max-w-measure text-body text-fg-muted">
              Les pondérations et leur justification sont détaillées dans{' '}
              <Link href="/guides" className="underline decoration-dotted underline-offset-4">
                les guides
              </Link>
              .
            </p>
          </section>

          <section aria-labelledby="techniques" className="mt-12">
            <h2 id="techniques" className="text-h2 font-600">
              Techniques praticables
            </h2>
            <p className="mt-2 max-w-measure text-body text-fg-muted">
              Ce qui se pratique réellement ici, selon le fond et l’accès. Le score, lui, est
              calibré pour la pêche du bord en général : il ne se décline pas encore par technique.
            </p>
            <dl className="mt-6 divide-y divide-edge">
              {spot.techniques.map((technique) => (
                <div key={technique} className="py-4">
                  <dt className="text-h3 font-600">{TECHNIQUE_LABELS[technique]}</dt>
                  <dd className="mt-1 max-w-measure text-body text-fg-muted">
                    {TECHNIQUE_DESCRIPTIONS[technique]}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        </div>

        <aside className="mt-12 xl:mt-0">
          <section aria-labelledby="spot" className="surface p-4">
            <h2 id="spot" className="text-h2 font-600">
              Le spot
            </h2>
            <dl className="mt-4 grid grid-cols-2 gap-3 font-mono text-data">
              {[
                ['Type', SPOT_TYPE_LABELS[spot.type]],
                ['Fond', BOTTOM_LABELS[spot.bottom]],
                ['Exposition', EXPOSURE_LABELS[spot.exposure]],
                ['Marnage moyen', `${spot.meanTideRangeM.toFixed(1).replace('.', ',')} m`],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="meta">
                    {label}
                  </dt>
                  <dd className="mt-0.5 text-fg-muted" data-numeric="">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 font-mono text-data text-fg-muted">
              Espèces cibles : {spot.species.join(', ')}.
            </p>
            <p className="mt-3 font-mono text-data text-fg-dim" data-numeric="">
              {spot.lat.toFixed(4).replace('.', ',')}, {spot.lng.toFixed(4).replace('.', ',')} ·
              orientation {Math.round(spot.facingDeg)}° vers le large
            </p>
          </section>

          <section aria-labelledby="acces" className="mt-6 surface p-4">
            <h2 id="acces" className="text-h2 font-600">
              Accès et sécurité
            </h2>
            <p className="mt-2 text-body text-fg-muted">{spot.access}</p>
          </section>

          <section aria-labelledby="alerte" className="mt-6 surface p-4">
            <h2 id="alerte" className="text-h2 font-600">
              Être prévenu pour ce spot
            </h2>
            <p className="mt-2 text-body text-fg-muted">
              Les alertes sur les bonnes fenêtres font partie du plan Pro, qui n’existe pas encore.
              Laissez votre adresse pour être prévenu au lancement.
            </p>
            <div className="mt-4">
              <EmailCaptureForm source={`spot:${spot.slug}`} />
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}
