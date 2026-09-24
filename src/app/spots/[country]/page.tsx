import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { CarteMoment } from '@/components/accueil/CarteMoment';
import { FriseCoefficients } from '@/components/accueil/FriseCoefficients';
import { PourquoiCeScore } from '@/components/accueil/PourquoiCeScore';
import { DemoDataNotice } from '@/components/data/DemoDataNotice';
import { TideCoverageDetail } from '@/components/data/TideCoverageDetail';
import { VueDirect } from '@/components/direct/VueDirect';
import { CarteStatique } from '@/components/carte/CarteStatique';
import { FichePaysBloc } from '@/components/pays/FichePaysBloc';
import { RetenirPays } from '@/components/pays/RetenirPays';
import { SpotCard } from '@/components/spot/SpotCard';
import { ButtonLink } from '@/components/ui/Button';
import { Section } from '@/components/ui/Section';
import { especesPhares, ficheDe, paysDe, paysPath, prepositionDe } from '@/data/pays';
import { regionPath } from '@/data/regions';
import { PAYS } from '@/data/spots';
import { collectSources, getSpotForecast, getSpotSummary, referenceNow } from '@/lib/forecast';
import { prochainsCoefficients } from '@/lib/forecast/coefficients';
import { resumePays } from '@/lib/forecast/pays';
import { absoluteUrl, spotPath } from '@/lib/routes';

export const revalidate = 3600;

interface RouteParams {
  country: string;
}

/** Les trois pays sont pré-rendus ; un slug inconnu tombe en 404. */
export function generateStaticParams(): RouteParams[] {
  return PAYS.map((pays) => ({ country: pays.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}): Promise<Metadata> {
  const { country } = await params;
  const pays = paysDe(country);
  if (!pays) return { title: 'Pays introuvable' };
  const fiche = ficheDe(pays.slug);

  return {
    title: `${fiche.titre} — ${pays.spots.length} spots, score en direct`,
    description: `${pays.spots.length} spots de pêche du bord ${prepositionDe(pays)}, ${pays.regions.join(', ')} : score du moment, marée, ce qui change ici — régime de marée, saison, réglementation, dangers propres au lieu.`,
    alternates: { canonical: absoluteUrl(paysPath(pays.slug)) },
    openGraph: {
      title: fiche.titre,
      description: fiche.accroche,
      url: absoluteUrl(paysPath(pays.slug)),
    },
  };
}

export default async function PaysPage({ params }: { params: Promise<RouteParams> }) {
  const { country } = await params;
  const pays = paysDe(country);
  if (!pays) notFound();
  const fiche = ficheDe(pays.slug);

  const now = referenceNow();
  const [forecasts, summaries] = await Promise.all([
    Promise.all(pays.spots.map((spot) => getSpotForecast(spot, now))),
    Promise.all(pays.spots.map((spot) => getSpotSummary(spot, now))),
  ]);
  const resume = resumePays(pays, forecasts, now);
  const coefficients = prochainsCoefficients(now, 30);
  const especes = especesPhares(pays, 6);

  const parRegion = pays.regions.map((region) => ({
    region,
    resumes: summaries
      .filter((summary) => summary.spot.regionName === region)
      .sort((a, b) => (b.current?.score.value ?? 0) - (a.current?.score.value ?? 0)),
  }));

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

  // « · » plutôt que « et » : les noms de façades en contiennent déjà un.
  const facades = fiche.facades.map((facade) => facade.nom).join(' · ');

  return (
    <>
      <div className="mx-auto w-full max-w-shell px-4 pt-6 md:px-8 md:pt-10">
        <nav aria-label="Fil d’Ariane" className="text-meta nums text-fg-muted">
          <Link href="/spots" className="underline decoration-dotted underline-offset-4">
            Spots
          </Link>
          {' / '}
          <span aria-current="page">{pays.nom}</span>
        </nav>

        <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start">
          <div>
            <p className="label">Pêche du bord · {pays.nom}</p>
            <h1 className="mt-3 max-w-[18ch] font-serif text-display font-semibold md:text-display-lg">
              {fiche.titre}
            </h1>
            <p className="mt-5 max-w-prose text-read text-fg-muted">{fiche.accroche}</p>

            <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-3 text-meta nums" data-numeric="">
              <div>
                <dt className="text-fg-muted">Spots</dt>
                <dd className="font-serif text-h2 font-semibold text-fg">{pays.spots.length}</dd>
              </div>
              <div>
                <dt className="text-fg-muted">Régions</dt>
                <dd className="font-serif text-h2 font-semibold text-fg">{pays.regions.length}</dd>
              </div>
              <div>
                <dt className="text-fg-muted">Façades</dt>
                <dd className="text-body text-fg">{facades}</dd>
              </div>
            </dl>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <RetenirPays slug={pays.slug} nom={pays.nom} />
              <ButtonLink href={`/spots?pays=${pays.slug}`} variant="secondary">
                Filtrer les {pays.spots.length} spots
              </ButtonLink>
              <Link
                href="/carte"
                className="inline-flex min-h-[48px] items-center text-body text-fg underline decoration-dotted underline-offset-4"
              >
                Voir sur la carte
              </Link>
            </div>
          </div>

          <div className="surface p-3">
            <CarteStatique points={points} label={`Les spots ${prepositionDe(pays)}, cliquables`} tuilesMax={9} ratio={1.1} />
            <p className="card-source mt-3">
              Chaque point est un spot, teinté par son score du moment : cliquez-en un. Carte de
              repérage — elle ne remplace pas une carte marine.
            </p>
          </div>
        </div>

        <div className="mt-6">
          <DemoDataNotice
            sources={collectSources(summaries)}
            detail={<TideCoverageDetail real={resume.marees.reelles} simulated={resume.marees.simulees} />}
          />
        </div>
      </div>

      <Section
        title={`En ce moment ${prepositionDe(pays)}`}
        lead="Le meilleur spot du pays sur le créneau en cours, sa marée sur vingt-quatre heures et sa semaine. Puis les deux fenêtres où l’on pêche vraiment du bord : ce soir et demain matin."
      >
        <div className="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
          <VueDirect resume={resume} now={now} />

          <div>
            {resume.moments.length === 0 ? (
              <p className="max-w-prose text-body text-fg-muted">
                Aucun créneau praticable ce soir ni demain matin {prepositionDe(pays)} : soit ces
                fenêtres sont passées, soit les conditions y sont dangereuses partout.
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

      <Section
        title="Ce qui change ici"
        lead={`Un pêcheur qui change de pays doit réapprendre quatre choses : la marée, la saison, la règle et le danger. Voici ce qu’elles sont ${prepositionDe(pays)}.`}
      >
        <FichePaysBloc
          fiche={fiche}
          especes={especes}
          marees={{ reelles: resume.marees.reelles.length, simulees: resume.marees.simulees.length }}
        />
      </Section>

      <Section
        title="Les spots, région par région"
        lead="Dans chaque région, du meilleur score en cours au moins bon."
      >
        <div className="space-y-10">
          {parRegion.map(({ region, resumes }) => (
            <div key={region}>
              <h3 className="font-serif text-h2 font-semibold">
                <Link
                  href={regionPath(pays.slug, resumes[0]?.spot.regionSlug ?? '')}
                  className="underline decoration-dotted underline-offset-4"
                >
                  {region}
                </Link>{' '}
                <span className="text-body font-400 text-fg-muted nums" data-numeric="">
                  · {resumes.length} spot{resumes.length > 1 ? 's' : ''}
                </span>
              </h3>
              <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {resumes.map((summary) => (
                  <li key={summary.spot.slug}>
                    <SpotCard summary={summary} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Le calendrier des coefficients"
        lead={`Trente jours d’avance. ${
          fiche.facades.some((f) => f.sea === 'mediterranee')
            ? 'Il ne vaut que pour la façade atlantique : en Méditerranée, le marnage se compte en centimètres.'
            : 'Les vives-eaux tombent deux fois par mois et se calculent un an à l’avance.'
        }`}
      >
        <FriseCoefficients jours={coefficients} />
      </Section>
    </>
  );
}
