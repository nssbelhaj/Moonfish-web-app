import type { Metadata } from 'next';

import { DataSourceTag } from '@/components/data/DataSourceTag';
import { DemoDataNotice } from '@/components/data/DemoDataNotice';
import { SpotTabs } from '@/components/spot/SpotTabs';
import { SpeciesCard } from '@/components/v3/SpeciesCard';
import { SpeciesWindowChart } from '@/components/v3/SpeciesWindowChart';
import { SPECIES_BY_NAME, seaOf } from '@/data/species';
import { sourceList } from '@/lib/forecast';
import { absoluteUrl, spotPath } from '@/lib/routes';
import { speciesActivity } from '@/lib/species/activity';
import { findSpot, resolveSpot, type RouteParams } from '../spot-page-data';

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}): Promise<Metadata> {
  const spot = await findSpot(params);
  if (!spot) return { title: 'Spot introuvable' };

  return {
    title: `${spot.name} — quelles espèces, à quel moment de la marée`,
    description: `Indice d’activité par espèce à ${spot.name} : fenêtre de marée, montage, appât et taille légale de capture.`,
    alternates: { canonical: absoluteUrl(`${spotPath(spot)}/especes`) },
  };
}

export default async function SpotSpeciesPage({ params }: { params: Promise<RouteParams> }) {
  const { spot, forecast } = await resolveSpot(params);
  const current = forecast.current;
  const today = forecast.days[0];
  const sea = seaOf(spot.regionSlug);

  // Le catalogue du spot, dans l'ordre où le modèle les classe. Les mauvais
  // indices restent affichés : savoir qu'une espèce n'est PAS là fait partie de
  // la réponse (D4).
  const activities = current
    ? spot.species
        .map((name) => SPECIES_BY_NAME.get(name.toLowerCase()))
        .filter((s): s is NonNullable<typeof s> => s !== undefined)
        .map((species) => speciesActivity(species, spot, current))
        .sort((a, b) => (b.index ?? -1) - (a.index ?? -1))
    : [];

  return (
    <>
      <div className="mx-auto w-full max-w-shell px-4 pt-6 md:px-8">
        <SpotTabs basePath={spotPath(spot)} active="especes" />
        <div className="mt-6">
          <DemoDataNotice sources={sourceList(forecast.sources)} />
        </div>
      </div>

      <div className="mx-auto w-full max-w-shell px-4 py-8 md:px-8 md:py-12">
        <section aria-labelledby="fenetres">
          <h2 id="fenetres" className="font-serif text-h2 font-semibold">
            Fenêtres d’activité
          </h2>
          <p className="mt-2 max-w-prose text-body text-fg-muted">
            Une espèce n’est pas « bonne » ou « mauvaise » : elle a une fenêtre. L’indice sert à
            trier, la fenêtre à décider — elle est posée sur la même courbe de marée que l’onglet
            Live, pour n’avoir qu’une lecture à apprendre.
          </p>

          {today && activities.length > 0 ? (
            <div className="surface mt-4 p-[14px]">
              <p className="text-[11.5px] text-fg-muted">
                Fenêtres d’activité sur la marée en cours
              </p>
              <div className="mt-2">
                <SpeciesWindowChart
                  activities={activities}
                  tideEvents={forecast.tideEvents}
                  dayStart={today.date}
                  timeZone={spot.timezone}
                  now={forecast.generatedAt}
                />
              </div>
              <p className="card-source mt-2">
                Modèle espèces Moonfish — fenêtres de marée, lumière et fond. Ce n’est pas une
                mesure : aucune prise n’est prédite, et rien n’est promis.
              </p>
            </div>
          ) : (
            <p className="mt-4 text-body text-fg-muted">
              Indices indisponibles pour ce créneau.
            </p>
          )}
        </section>

        <section aria-labelledby="classement" className="mt-10">
          <h2 id="classement" className="font-serif text-h2 font-semibold">
            Le classement du moment
          </h2>
          <p className="mt-2 max-w-prose text-body text-fg-muted">
            Les espèces mal placées restent listées, avec leur indice. Les masquer donnerait
            l’illusion que tout est possible sur ce spot, à toute heure.
          </p>

          <div className="mt-4 flex flex-col gap-3">
            {activities.map((activity, index) => (
              <SpeciesCard
                key={activity.species.slug}
                activity={activity}
                sea={sea}
                expanded={index === 0}
              />
            ))}
          </div>

          <div className="demo-frame mt-4 p-[13px]">
            <p className="font-serif text-[13px] italic text-accent">
              Aucune promesse de prise
            </p>
            <p className="mt-1 text-[11.5px] text-fg-muted">
              Ces indices décrivent des conditions, pas un résultat. La mer décide.
            </p>
          </div>

          <DataSourceTag
            status={forecast.sources.tide}
            serverNow={forecast.generatedAt}
            timeZone={spot.timezone}
          />
        </section>
      </div>
    </>
  );
}
