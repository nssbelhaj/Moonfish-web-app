import type { Metadata } from 'next';
import Link from 'next/link';

import { DemoDataNotice } from '@/components/data/DemoDataNotice';
import { SpotsMap } from '@/components/v3/SpotsMap';
/*
  Importé normalement, sans `next/dynamic`.

  Le composant est marqué `'use client'` mais ne touche Leaflet QUE dans son
  effet : au rendu serveur il ne produit qu'un conteneur vide, donc rien à
  désactiver. La bibliothèque, elle, reste chargée à la demande — l'import
  dynamique est à l'intérieur du composant, où il a du sens.
*/
import { CarteInteractive, type PointCarte } from '@/components/map/CarteInteractive';
import { collectSources, getAllSpotSummaries } from '@/lib/forecast';
import { MARKER_SHAPES } from '@/lib/map/projection';
import { absoluteUrl, spotPath } from '@/lib/routes';
import { formatScore, tierForOrNull } from '@/lib/score-display';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Carte des spots et scores du jour',
  description:
    'Tous les spots Luna Marea sur une carte, avec le score du créneau en cours. Chaque marqueur mène à la page du spot.',
  alternates: { canonical: absoluteUrl('/carte') },
};

export default async function CartePage() {
  const summaries = await getAllSpotSummaries();

  const points: PointCarte[] = summaries.map(({ spot, current }) => {
    const valeur = current?.score.value ?? null;
    const tier = tierForOrNull(valeur);
    const danger = current?.score.safety.level === 'danger';

    return {
      slug: spot.slug,
      nom: spot.name,
      region: spot.regionName,
      lat: spot.lat,
      lng: spot.lng,
      href: spotPath(spot),
      score: valeur,
      palier: danger ? 'Danger — ne pas sortir' : (tier?.label ?? 'Score indisponible'),
      couleur: danger ? 'var(--danger)' : (tier?.colorVar ?? 'var(--edge-strong)'),
      forme: MARKER_SHAPES[spot.type],
      danger,
    };
  });

  return (
    <div className="mx-auto w-full max-w-shell px-4 py-8 md:px-8 md:py-12">
      <h1 className="font-serif text-h1 font-semibold">Carte des spots</h1>
      <p className="mt-3 max-w-prose text-body text-fg-muted">
        Chaque marqueur porte le score du créneau en cours et mène à la page du spot. Trois
        informations indépendantes s’y superposent : le chiffre, la couleur du palier, et une forme
        par type de spot — en niveaux de gris, ou pour un œil qui distingue mal les couleurs, la
        carte reste lisible.
      </p>

      <div className="mt-6">
        <DemoDataNotice sources={collectSources(summaries)} />
      </div>

      <div className="mt-6">
        <CarteInteractive points={points} />
      </div>

      <p className="card-source mt-3">
        Fond de carte © les contributeurs d’
        <a
          href="https://www.openstreetmap.org/copyright"
          className="underline decoration-dotted underline-offset-4"
          rel="noreferrer"
        >
          OpenStreetMap
        </a>
        . Les tuiles passent par notre serveur : votre navigateur ne joint aucun tiers, et
        OpenStreetMap ne reçoit ni votre adresse IP ni la zone que vous regardez. Carte de
        repérage — elle ne remplace pas une carte marine.
      </p>

      {/*
        Sans JavaScript, la carte à tuiles ne s'affiche pas. La carte dessinée
        au serveur prend alors le relais : mêmes positions, mêmes scores, mêmes
        liens. Elle est masquée quand le script fonctionne, pour ne pas montrer
        deux fois la même chose.
      */}
      <noscript>
        <div className="mt-8">
          <h2 className="font-serif text-h2 font-semibold">Carte de repérage</h2>
          <p className="mt-2 max-w-prose text-body text-fg-muted">
            La carte interactive demande JavaScript. Voici la même information, dessinée au
            serveur.
          </p>
          <div className="mt-4">
            <SpotsMap summaries={summaries} />
          </div>
        </div>
      </noscript>

      {/*
        La liste n'est pas une redite : c'est le chemin le plus court vers un
        spot au clavier, et la seule forme lisible par un lecteur d'écran sans
        parcourir une carte.
      */}
      <h2 className="mt-10 font-serif text-h2 font-semibold">Tous les spots</h2>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {summaries.map(({ spot, current }) => {
          const valeur = current?.score.value ?? null;
          const tier = tierForOrNull(valeur);
          const danger = current?.score.safety.level === 'danger';
          const couleur = danger ? 'var(--danger)' : (tier?.colorVar ?? 'var(--edge-strong)');

          return (
            <li key={spot.slug}>
              <Link
                href={spotPath(spot)}
                className="surface flex min-h-tap items-center justify-between gap-3 p-3 tappable"
              >
                <span>
                  <span className="block text-body font-semibold text-fg">{spot.name}</span>
                  <span className="block text-meta text-fg-muted">{spot.regionName}</span>
                </span>
                <span className="text-right">
                  <span
                    className="block text-[19px] font-bold nums"
                    style={{ color: couleur }}
                    data-numeric=""
                  >
                    {formatScore(valeur)}
                  </span>
                  <span className="block text-[11px]" style={{ color: couleur }}>
                    {danger ? 'Danger' : (tier?.label ?? 'Indispo.')}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
