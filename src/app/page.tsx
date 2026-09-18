import type { Metadata } from 'next';

import { CATALOGUE } from '@/data/spots';
import { FACTOR_LABELS, FACTOR_WEIGHTS } from '@/lib/scoring';
import Link from 'next/link';
import { DemoDataNotice } from '@/components/data/DemoDataNotice';
import { EmailCaptureForm } from '@/components/forms/EmailCaptureForm';
import { SpotSearch, type SearchableSpot } from '@/components/forms/SpotSearch';
import { SpotCard } from '@/components/spot/SpotCard';
import { ButtonLink } from '@/components/ui/Button';
import { Section } from '@/components/ui/Section';
import { collectSources, getAllSpotSummaries, referenceNow } from '@/lib/forecast';
import { tides, weather } from '@/lib/providers';
import { absoluteUrl, spotPath } from '@/lib/routes';
import { formatDateTime } from '@/lib/time';

/** Les données sont recalculées chaque heure ; la page reste statique entre-temps. */
export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Luna Marea — les meilleurs créneaux de pêche en mer, spot par spot',
  description:
    `Un score sur 10 par créneau de 2 heures, sur 7 jours, pour ${CATALOGUE.total} spots de pêche du bord ${CATALOGUE.etendue}. Surfcasting, lancer-ramener, rockfishing, shore-jigging. Marée, vent, houle et périodes solunaires, expliqués et pondérés.`,
  alternates: { canonical: absoluteUrl('/') },
  openGraph: {
    title: 'Luna Marea — les meilleurs créneaux de pêche en mer, spot par spot',
    description:
      `Score de pêche du bord sur 7 jours : marée, vent, houle, lune. ${CATALOGUE.total} spots ${CATALOGUE.etendue}.`,
    url: absoluteUrl('/'),
  },
};

/**
 * La réponse sur l'origine des données ne peut pas être écrite en dur : elle
 * change avec les fournisseurs branchés. Une FAQ qui affirmerait encore que les
 * marées sont simulées après leur branchement serait fausse — et une FAQ fausse
 * détruit plus de confiance qu'une FAQ absente.
 */
const DATA_QUESTION = {
  question: 'Les données affichées sont-elles réelles ?',
  answer: (() => {
    const simulated = [
      tides.source.kind === 'simulated' ? 'les marées' : null,
      weather.source.kind === 'simulated' ? 'le vent et la houle' : null,
    ].filter((item): item is string => item !== null);

    const base =
      'Le lever et le coucher du Soleil ainsi que la phase de Lune sont calculés localement, et chaque bloc indique sa provenance et sa fraîcheur.';

    if (simulated.length === 0) {
      return `Oui. Les marées viennent de ${tides.source.name}, le vent et la houle des modèles Open-Meteo. ${base}`;
    }

    return `En partie. ${simulated.join(' et ')} ${simulated.length > 1 ? 'sont simulés' : 'sont simulées'} et signalés comme tels sur chaque page. Le reste vient de fournisseurs réels. ${base}`;
  })(),
} as const;

const FAQ = [
  {
    question: 'Comment le score Luna Marea est-il calculé ?',
    answer:
      'Cinq facteurs pondérés : la marée pour 35 %, le vent pour 25 %, la houle pour 20 %, les périodes solunaires et la lune pour 15 %, la lumière pour 5 %. Chaque sous-score et son poids sont affichés sur la page du spot, avec la phrase qui l’explique.',
  },
  DATA_QUESTION,
  {
    question: 'Un score élevé garantit-il une prise ?',
    answer:
      'Non, et aucun outil ne le peut. Le score mesure la qualité des conditions, pas la présence du poisson. Il sert à choisir entre deux créneaux, pas à promettre un résultat.',
  },
  {
    question: 'Que se passe-t-il quand la mer est dangereuse ?',
    answer:
      'Au-delà de 2,5 m de houle ou de 50 km/h de vent, un bandeau d’alerte s’affiche au-dessus du score et ne peut pas être fermé, quel que soit le score calculé. La sécurité ne dépend jamais du score.',
  },
] as const;

export default async function HomePage() {
  const now = referenceNow();
  const summaries = await getAllSpotSummaries(now);
  const featured = summaries.slice(0, 3);
  const sources = collectSources(summaries);

  const searchable: SearchableSpot[] = summaries.map((summary) => ({
    slug: summary.spot.slug,
    name: summary.spot.name,
    regionName: summary.spot.regionName,
    countryName: summary.spot.countryName,
    href: spotPath(summary.spot),
    score: summary.current?.score.value ?? null,
  }));

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <div className="mx-auto w-full max-w-shell px-4 pb-4 pt-8 md:px-8 md:pt-12">
        <h1 className="max-w-[16ch] font-serif text-h1 font-semibold">
          Les meilleurs créneaux de pêche en mer, spot par spot
        </h1>
        <p className="mt-4 max-w-prose text-body text-fg-muted">
          Un score sur 10 par tranche de deux heures, sur sept jours. Marée, vent, houle, lune et
          lumière, pondérés et expliqués — pour choisir quand y aller, pas pour vous promettre une
          prise. Surfcasting, lancer-ramener, rockfishing : chaque spot indique ce qui s’y pratique.
        </p>

        <div className="mt-6 max-w-[42rem]">
          <SpotSearch spots={searchable} />
        </div>

        <div className="mt-6">
          <DemoDataNotice sources={sources} />
        </div>
      </div>

      <Section
        title="Les trois meilleurs créneaux en ce moment"
        lead="Classement établi sur le score du créneau en cours, tous spots confondus. Un spot en conditions dangereuses n’y figure jamais en tête."
      >
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((summary) => (
            <li key={summary.spot.slug}>
              <SpotCard summary={summary} />
            </li>
          ))}
        </ul>

        <div className="mt-6">
          <ButtonLink href="/spots" variant="secondary">
            Voir les {CATALOGUE.total} spots
          </ButtonLink>
        </div>
      </Section>

      <Section
        title="Ce que le score regarde"
        lead="Sept facteurs, pondérés. Le poids compte autant que la note : un excellent score de lumière ne rattrape pas une mauvaise marée."
      >
        {/*
          Une liste pondérée plutôt qu'une rangée de cartes identiques.
          Quatre cartes côte à côte, c'est la mise en page générique par défaut —
          et surtout elle rendait les poids indiscernables, alors que l'écart
          entre 30 % et 5 % est toute l'information de cette section.

          ─── Les poids viennent du MOTEUR, ils ne sont plus recopiés ──────
          Ils l'étaient : « 35 / 25 / 20 / 15 / 5 », cinq facteurs. Le modèle
          en comptait six depuis l'arrivée de la pression, et sept depuis
          celle de l'eau — cette page annonçait donc des pondérations que le
          score n'appliquait plus, et rien ne pouvait le signaler. Elle lit
          maintenant `FACTOR_WEIGHTS`, la seule source de vérité.
        */}
        <ul className="divide-y divide-edge">
          {(
            [
              {
                facteur: 'tide',
                body: 'La fenêtre de deux heures avant à une heure après la pleine mer, et la descendante établie. L’étale est pénalisée : sans courant, rien ne circule.',
                href: '/guides/comprendre-les-coefficients-de-maree',
                link: 'Comprendre les coefficients',
              },
              {
                facteur: 'wind',
                body: '10 à 25 km/h de secteur mer brassent le bord sans le rendre impêchable. Au-delà de 40 km/h, c’est non.',
                href: '/guides/vent-houle-et-surfcasting',
                link: 'Vent, houle et surfcasting',
              },
              {
                facteur: 'swell',
                body: 'Entre 0,5 et 1,5 m, la mer travaille le bord. Sous 0,3 m elle est trop lisse ; au-delà de 2,5 m, la question n’est plus la pêche.',
                href: '/guides/vent-houle-et-surfcasting',
                link: 'Lire l’état de mer',
              },
              {
                facteur: 'solunar',
                body: 'Périodes majeures au zénith et au nadir, mineures au lever et au coucher. Bonus en vive-eau. Un effet réel, mais modeste.',
                href: '/guides/lune-et-periodes-solunaires',
                link: 'Ce que vaut vraiment le solunaire',
              },
              {
                facteur: 'pressure',
                body: 'La tendance, pas la valeur : une pression qui baisse précède souvent une phase active, une remontée franche derrière un front la referme.',
                href: '/guides/vent-houle-et-surfcasting',
                link: 'Lire une tendance',
              },
              {
                facteur: 'water',
                body: 'Le métabolisme d’un poisson suit celui de l’eau : trop froide il ralentit, trop chaude l’oxygène manque. Le plateau va de 11 à 22 °C — assez large pour la Bretagne comme pour Agadir.',
                href: '/guides/quand-pecher-le-bar-du-bord',
                link: 'Quand pêcher le bar',
              },
              {
                facteur: 'light',
                body: 'Aube, crépuscule et nuit devant le plein jour. Le poids est faible parce que l’effet, seul, l’est aussi.',
                href: '/guides/quand-pecher-le-bar-du-bord',
                link: 'Quand pêcher le bar',
              },
            ] as const
          ).map((entree) => {
            const poids = Math.round(FACTOR_WEIGHTS[entree.facteur] * 100);
            const maximum = Math.round(Math.max(...Object.values(FACTOR_WEIGHTS)) * 100);

            return (
              <li key={entree.facteur} className="py-6">
                <div className="flex items-baseline gap-4">
                  <span
                    className="w-16 shrink-0 nums font-serif text-h1 font-semibold text-fg"
                    data-numeric=""
                  >
                    {poids}
                    <span className="text-body font-500 text-fg-faint"> %</span>
                  </span>
                  <h3 className="text-body font-semibold font-600">{FACTOR_LABELS[entree.facteur]}</h3>
                </div>

                {/* La barre rend l'écart de poids immédiatement lisible. */}
                <div className="ml-20 mt-2 h-1 rounded-[2px] bg-surface-2" aria-hidden="true">
                  <div
                    className="h-full rounded-[2px] bg-accent-score"
                    style={{ width: `${(poids / maximum) * 100}%` }}
                  />
                </div>

                <p className="ml-20 mt-3 max-w-prose text-body text-fg-muted">{entree.body}</p>
                <Link
                  href={entree.href}
                  className="ml-20 mt-2 inline-flex min-h-[44px] items-center text-meta nums text-fg underline decoration-dotted underline-offset-4"
                >
                  {entree.link}
                </Link>
              </li>
            );
          })}
        </ul>
      </Section>

      <Section title="Questions fréquentes">
        <dl className="divide-y divide-edge">
          {FAQ.map((item) => (
            <div key={item.question} className="py-4">
              <dt className="text-body font-semibold font-600">{item.question}</dt>
              <dd className="mt-2 max-w-prose text-body text-fg-muted">{item.answer}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section
        id="waitlist"
        title="Être prévenu des prochaines fonctionnalités"
        lead="Alertes sur vos fenêtres favorables, favoris, carnet de prises. Une seule adresse suffit, et vous ne recevrez rien d’autre."
      >
        <div className="max-w-[42rem]">
          <EmailCaptureForm source="accueil" />
        </div>
        <p className="mt-4 text-meta nums text-fg-faint" data-numeric="">
          Prochaine fenêtre la plus proche, tous spots confondus :{' '}
          {summaries[0]?.nextGood
            ? `${summaries[0].spot.name}, ${formatDateTime(new Date(summaries[0].nextGood.start), summaries[0].spot.timezone)}`
            : 'aucune sous 7 jours'}
          .
        </p>
      </Section>
    </>
  );
}
