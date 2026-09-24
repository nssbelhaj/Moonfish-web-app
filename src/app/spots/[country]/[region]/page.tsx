import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { CarteMoment } from '@/components/accueil/CarteMoment';
import { PourquoiCeScore } from '@/components/accueil/PourquoiCeScore';
import { DemoDataNotice } from '@/components/data/DemoDataNotice';
import { TideCoverageDetail } from '@/components/data/TideCoverageDetail';
import { VueDirect } from '@/components/direct/VueDirect';
import { ConstellationPays } from '@/components/pays/ConstellationPays';
import { SpotCard } from '@/components/spot/SpotCard';
import { ButtonLink } from '@/components/ui/Button';
import { Section } from '@/components/ui/Section';
import { paysPath, prepositionDe } from '@/data/pays';
import { REGIONS, ficheRegionDe, regionDe } from '@/data/regions';
import { TECHNIQUE_LABELS } from '@/data/spots';
import { collectSources, getSpotForecast, getSpotSummary, referenceNow } from '@/lib/forecast';
import { resumePays } from '@/lib/forecast/pays';
import { absoluteUrl, spotPath } from '@/lib/routes';

export const revalidate = 3600;

interface RouteParams {
  country: string;
  region: string;
}

/** Les dix-sept régions sont pré-rendues ; un couple inconnu tombe en 404. */
export function generateStaticParams(): RouteParams[] {
  return REGIONS.map((region) => ({ country: region.pays.slug, region: region.slug }));
}

export async function generateMetadata({ params }: { params: Promise<RouteParams> }): Promise<Metadata> {
  const { country, region: regionSlug } = await params;
  const region = regionDe(country, regionSlug);
  if (!region) return { title: 'Région introuvable' };
  const fiche = ficheRegionDe(region.slug);
  const noms = region.spots.map((spot) => spot.name).join(', ');

  return {
    title: `${fiche.titre} — ${region.spots.length} spot${region.spots.length > 1 ? 's' : ''}, score en direct`,
    description: `${noms} : score du créneau en cours, marée, vent et houle. ${fiche.accroche}`.slice(0, 300),
    alternates: { canonical: absoluteUrl(`/spots/${region.pays.slug}/${region.slug}`) },
    openGraph: {
      title: fiche.titre,
      description: fiche.accroche,
      url: absoluteUrl(`/spots/${region.pays.slug}/${region.slug}`),
    },
  };
}

/** Les techniques praticables dans la région, de la plus à la moins répandue. */
function techniquesDe(spots: readonly { techniques: readonly string[] }[]): { nom: string; spots: number }[] {
  const compte = new Map<string, number>();
  for (const spot of spots) for (const t of spot.techniques) compte.set(t, (compte.get(t) ?? 0) + 1);
  return [...compte]
    .sort((a, b) => b[1] - a[1])
    .map(([cle, n]) => ({ nom: TECHNIQUE_LABELS[cle as keyof typeof TECHNIQUE_LABELS] ?? cle, spots: n }));
}

function especesDe(spots: readonly { species: readonly string[] }[]): { nom: string; spots: number }[] {
  const compte = new Map<string, number>();
  for (const spot of spots) for (const e of spot.species) compte.set(e, (compte.get(e) ?? 0) + 1);
  return [...compte].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'fr')).slice(0, 8).map(([nom, spots]) => ({ nom, spots }));
}

export default async function RegionPage({ params }: { params: Promise<RouteParams> }) {
  const { country, region: regionSlug } = await params;
  const region = regionDe(country, regionSlug);
  if (!region) notFound();
  const fiche = ficheRegionDe(region.slug);

  const now = referenceNow();
  const [forecasts, summaries] = await Promise.all([
    Promise.all(region.spots.map((spot) => getSpotForecast(spot, now))),
    Promise.all(region.spots.map((spot) => getSpotSummary(spot, now))),
  ]);
  summaries.sort((a, b) => (b.current?.score.value ?? 0) - (a.current?.score.value ?? 0));

  /*
    `resumePays` ne sait rien des pays : il choisit parmi les prévisions qu'on
    lui donne, restreintes aux spots listés. Une région est un « pays » plus
    petit pour ce calcul — même meilleur spot, mêmes deux moments — et c'est
    son nom qui s'affiche en sur-titre du direct, pas celui du pays.
  */
  const resume = resumePays({ ...region.pays, nom: region.nom, spots: region.spots }, forecasts, now);

  const points = summaries.map((summary) => ({
    slug: summary.spot.slug,
    name: summary.spot.name,
    lat: summary.spot.lat,
    lng: summary.spot.lng,
    href: spotPath(summary.spot),
    regionName: summary.spot.regionName,
    score: summary.current?.score.value ?? null,
    danger: summary.current?.score.safety.level === 'danger',
  }));

  const especes = especesDe(region.spots);
  const techniques = techniquesDe(region.spots);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: fiche.titre,
    description: fiche.accroche,
    url: absoluteUrl(`/spots/${region.pays.slug}/${region.slug}`),
    hasPart: region.spots.map((spot) => ({
      '@type': 'Place',
      name: spot.name,
      url: absoluteUrl(spotPath(spot)),
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="mx-auto w-full max-w-shell px-4 pt-6 md:px-8 md:pt-10">
        <nav aria-label="Fil d’Ariane" className="text-meta nums text-fg-muted">
          <Link href="/spots" className="underline decoration-dotted underline-offset-4">
            Spots
          </Link>
          {' / '}
          <Link href={paysPath(region.pays.slug)} className="underline decoration-dotted underline-offset-4">
            {region.pays.nom}
          </Link>
          {' / '}
          <span aria-current="page">{region.nom}</span>
        </nav>

        <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start">
          <div>
            <p className="label">
              Pêche du bord · {region.pays.nom} · {region.nom}
            </p>
            <h1 className="mt-3 max-w-[18ch] font-serif text-display font-semibold md:text-display-lg">
              {fiche.titre}
            </h1>
            <p className="mt-5 max-w-prose text-read text-fg-muted">{fiche.accroche}</p>

            <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-3 text-meta nums" data-numeric="">
              <div>
                <dt className="text-fg-muted">Spots</dt>
                <dd className="font-serif text-h2 font-semibold text-fg">{region.spots.length}</dd>
              </div>
              <div>
                <dt className="text-fg-muted">Techniques</dt>
                <dd className="text-body text-fg">{techniques.map((t) => t.nom).join(', ')}</dd>
              </div>
            </dl>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <ButtonLink href={`/spots?region=${region.slug}`} variant="secondary">
                Filtrer ces {region.spots.length} spot{region.spots.length > 1 ? 's' : ''}
              </ButtonLink>
              <Link
                href={paysPath(region.pays.slug)}
                className="inline-flex min-h-[48px] items-center text-body text-fg underline decoration-dotted underline-offset-4"
              >
                Tout le pays, {prepositionDe(region.pays)}
              </Link>
            </div>
          </div>

          <figure className="surface p-4">
            <div className="mx-auto max-w-[360px]">
              <ConstellationPays points={points} label={`Les spots de la région ${region.nom}, cliquables`} />
            </div>
            <figcaption className="card-source mt-3">
              Chaque point est un spot, à ses vraies coordonnées, teinté par son score du moment.
            </figcaption>
          </figure>
        </div>

        <div className="mt-6">
          <DemoDataNotice
            sources={collectSources(summaries)}
            detail={<TideCoverageDetail real={resume.marees.reelles} simulated={resume.marees.simulees} />}
          />
        </div>
      </div>

      <Section
        title="Le terrain, et le piège du lieu"
        lead="Ce qu’aucun calcul ne donne : la nature de la côte, ce qui s’y pêche et comment, et ce qui y fait rater — ou pire — une sortie."
      >
        <div className="grid gap-6 md:grid-cols-2">
          <section className="surface p-5">
            <h3 className="card-title">Le terrain</h3>
            <p className="mt-3 max-w-prose text-body text-fg-muted">{fiche.terrain}</p>
            <h4 className="mt-4 text-body font-600 text-fg">Les espèces les plus citées par nos spots</h4>
            <ul className="mt-2 flex flex-wrap gap-2">
              {especes.map((espece) => (
                <li key={espece.nom} className="pill inline-flex items-center gap-1.5 px-3 py-1 text-meta nums" data-numeric="">
                  <span className="text-fg">{espece.nom}</span>
                  <span className="text-fg-muted">{espece.spots}</span>
                </li>
              ))}
            </ul>
            <p className="card-source mt-4">Comptage sur le catalogue. Ce n’est pas une promesse de prise.</p>
          </section>

          <section className="surface p-5">
            <h3 className="card-title">Le piège du lieu</h3>
            <p className="mt-3 max-w-prose text-body text-fg-muted">{fiche.conseil}</p>
            <p className="card-source mt-4">
              Au-delà de 2,5 m de houle ou de 50 km/h de vent, le bandeau de danger s’affiche sur le
              spot, quel que soit le score.
            </p>
          </section>
        </div>
      </Section>

      <Section
        title={`En ce moment en ${region.nom}`}
        lead="Le meilleur spot de la région sur le créneau en cours, sa marée et sa semaine ; puis ce soir et demain matin."
      >
        <div className="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
          <VueDirect resume={resume} now={now} />
          <div>
            {resume.moments.length === 0 ? (
              <p className="max-w-prose text-body text-fg-muted">
                Aucun créneau praticable ce soir ni demain matin dans la région : soit ces fenêtres
                sont passées, soit les conditions y sont dangereuses partout.
              </p>
            ) : (
              <>
                <ul className="grid gap-4">
                  {resume.moments.map((moment) => (
                    <li key={moment.cle}>
                      <CarteMoment moment={moment} />
                    </li>
                  ))}
                </ul>
                <PourquoiCeScore moment={resume.moments[0]!} />
              </>
            )}
          </div>
        </div>
      </Section>

      <Section title={`Les spots, du meilleur score en cours au moins bon`}>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {summaries.map((summary) => (
            <li key={summary.spot.slug}>
              <SpotCard summary={summary} />
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}
