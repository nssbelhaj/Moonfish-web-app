import type { Metadata } from 'next';

import { DemoDataNotice } from '@/components/data/DemoDataNotice';
import { EmailCaptureForm } from '@/components/forms/EmailCaptureForm';
import { SpotTabs } from '@/components/spot/SpotTabs';
import { SpeciesCard } from '@/components/v3/SpeciesCard';
import { SPECIES_BY_NAME, seaOf } from '@/data/species';
import { sourceList } from '@/lib/forecast';
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

  const names = spot.species.slice(0, 4).join(', ').toLowerCase();

  return {
    title: `${spot.name} — espèces connues et tailles légales`,
    description: `Ce qui se pêche à ${spot.name} : ${names}. Fonds, montages et taille minimale de capture.`,
    alternates: { canonical: absoluteUrl(`${spotPath(spot)}/especes`) },
  };
}

export default async function SpotSpeciesPage({ params }: { params: Promise<RouteParams> }) {
  const { spot, forecast } = await resolveSpot(params);
  const sea = seaOf(spot.regionSlug);

  const known = spot.species
    .map((name) => SPECIES_BY_NAME.get(name.toLowerCase()))
    .filter((s): s is NonNullable<typeof s> => s !== undefined);

  const unlisted = spot.species.filter((name) => !SPECIES_BY_NAME.has(name.toLowerCase()));

  return (
    <>
      <div className="mx-auto w-full max-w-shell px-4 pt-6 md:px-8">
        <SpotTabs basePath={spotPath(spot)} active="especes" />
        <div className="mt-6">
          <DemoDataNotice sources={sourceList(forecast.sources)} />
        </div>
      </div>

      <div className="mx-auto w-full max-w-shell px-4 py-8 md:px-8 md:py-12">
        <section aria-labelledby="connues">
          <h2 id="connues" className="font-serif text-h2 font-semibold">
            Espèces connues sur ce spot
          </h2>

          {/*
            La portée de cette page est écrite AVANT la liste, pas en note de bas
            de page. C'est ce qui distingue « ce qui se pêche sur cette côte » de
            « ce qui mord ici, maintenant » — et nous ne savons dire que le
            premier.
          */}
          <p className="mt-2 max-w-prose text-body text-fg-muted">
            Cette liste dit ce qui se pêche sur cette côte, sur ce type de fond. Elle ne dit pas ce
            qui mord aujourd’hui : aucune source publique ne publie de statistiques de prises spot
            par spot, et nous préférons l’écrire plutôt que de le deviner. Ce sont les prises
            déclarées par les pêcheurs qui rempliront ce vide.
          </p>

          <div className="mt-4 flex flex-col gap-3">
            {known.map((species) => (
              <SpeciesCard
                key={species.slug}
                species={species}
                sea={sea}
                spotBottom={spot.bottom}
              />
            ))}
          </div>

          {unlisted.length > 0 && (
            <p className="mt-4 text-meta text-fg-muted">
              Également signalées sur ce spot, sans fiche détaillée pour l’instant :{' '}
              {unlisted.join(', ')}.
            </p>
          )}
        </section>

        <section aria-labelledby="contributions" className="mt-10">
          <h2 id="contributions" className="font-serif text-h2 font-semibold">
            Vos prises sur ce spot
          </h2>

          {/*
            D12 : le bloc existe AVANT la fonctionnalité, et annonce qu'elle est
            en préparation. Il mesure l'intention de contribuer sans mentir sur
            la disponibilité — un formulaire qui ferait semblant d'enregistrer
            serait pire que pas de formulaire du tout.
          */}
          <div className="demo-frame mt-4 p-4">
            <p className="font-serif text-[13px] italic text-accent">En préparation</p>
            <p className="mt-2 max-w-prose text-body text-fg-muted">
              Le carnet de prises n’est pas encore ouvert. Il permettra de déclarer une prise —
              espèce, taille, moment de la marée, photo — et de noter le spot. Ce sont ces
              déclarations qui diront un jour ce qui se prend réellement ici, et à quel moment :
              c’est la seule source honnête pour cette information.
            </p>
            <p className="mt-3 max-w-prose text-body text-fg-muted">
              Il demandera un compte, parce qu’une prise anonyme n’est pas vérifiable et qu’une
              note anonyme ne vaut rien.
            </p>
            <div className="mt-4">
              <EmailCaptureForm source={`especes:${spot.slug}`} />
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
