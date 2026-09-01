import type { Metadata } from 'next';

import { DemoDataNotice } from '@/components/data/DemoDataNotice';
import { SpotsMap } from '@/components/v3/SpotsMap';
import { collectSources, getAllSpotSummaries } from '@/lib/forecast';
import { absoluteUrl } from '@/lib/routes';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Carte des spots et scores du jour',
  description:
    'Tous les spots Moonfish sur une carte de repérage, avec le score du créneau en cours. Positions réelles, fond dessiné, non destinée à la navigation.',
  alternates: { canonical: absoluteUrl('/carte') },
};

export default async function CartePage() {
  const summaries = await getAllSpotSummaries();

  return (
    <div className="mx-auto w-full max-w-shell px-4 py-8 md:px-8 md:py-12">
      <h1 className="font-serif text-h1 font-semibold">Carte des spots</h1>
      <p className="mt-3 max-w-prose text-body text-fg-muted">
        Chaque marqueur porte trois informations qui ne dépendent pas les unes des autres : le
        chiffre du score, la couleur du palier, et une forme par type de spot. En niveaux de gris,
        ou pour un œil qui distingue mal les couleurs, la carte reste lisible.
      </p>

      <div className="mt-6">
        <DemoDataNotice sources={collectSources(summaries)} />
      </div>

      <div className="mt-6">
        <SpotsMap summaries={summaries} />
      </div>
    </div>
  );
}
