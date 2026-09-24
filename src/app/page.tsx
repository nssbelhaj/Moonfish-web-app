import type { Metadata } from 'next';
import Link from 'next/link';

import { CarteMoment } from '@/components/accueil/CarteMoment';
import { CartesPays, type CartePays } from '@/components/accueil/CartesPays';
import { DernieresContributions } from '@/components/accueil/DernieresContributions';
import { FriseCoefficients } from '@/components/accueil/FriseCoefficients';
import { PourquoiCeScore } from '@/components/accueil/PourquoiCeScore';
import { SelecteurFacade } from '@/components/accueil/SelecteurFacade';
import { DemoDataNotice } from '@/components/data/DemoDataNotice';
import { VueDirect } from '@/components/direct/VueDirect';
import { EmailCaptureForm } from '@/components/forms/EmailCaptureForm';
import { SpotSearch, type SearchableSpot } from '@/components/forms/SpotSearch';
import { NearbySpots } from '@/components/spot/NearbySpots';
import { ButtonLink } from '@/components/ui/Button';
import { Section } from '@/components/ui/Section';
import { ficheDe, prepositionDe } from '@/data/pays';
import { CATALOGUE, PAYS } from '@/data/spots';
import { moonPhase } from '@/lib/astro';
import { FACADE_PAR_DEFAUT } from '@/lib/facade';
import { collectSources, getAllSpotSummaries, getSpotForecast, referenceNow } from '@/lib/forecast';
import { prochainsCoefficients } from '@/lib/forecast/coefficients';
import { resumePays } from '@/lib/forecast/pays';
import { contributions, tides, weather } from '@/lib/providers';
import { absoluteUrl, spotPath } from '@/lib/routes';
import {
  FACTOR_COUNT_WORD,
  FACTOR_LABELS,
  FACTOR_WEIGHTS,
  factorWeightSentence,
  moonPhaseName,
} from '@/lib/scoring';
import { formatDayLong } from '@/lib/time';

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

/** Combien de contributions récentes on affiche, par type. */
const COMBIEN_DE_CONTRIBUTIONS = 4;
/** Longueur de la frise des coefficients. Un mois couvre deux vives-eaux. */
const JOURS_DE_FRISE = 30;

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
    /*
      La phrase est ASSEMBLÉE depuis les poids du moteur. Elle disait « Cinq
      facteurs pondérés : la marée pour 35 %… » alors que le modèle en compte
      sept et n'a jamais appliqué ces pourcentages depuis l'arrivée de la
      pression. Une FAQ qui se trompe sur le calcul qu'elle explique est pire
      qu'une FAQ absente.
    */
    answer: `${FACTOR_COUNT_WORD} facteurs pondérés : ${factorWeightSentence()}. Chaque sous-score et son poids sont affichés sur la page du spot, avec la phrase qui l’explique.`,
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

/** Les libellés des facteurs, avec le texte qui les explique et son guide. */
const EXPLICATIONS = {
  tide: {
    body: 'La fenêtre de deux heures avant à une heure après la pleine mer, et la descendante établie. L’étale est pénalisée : sans courant, rien ne circule.',
    href: '/guides/comprendre-les-coefficients-de-maree',
    link: 'Comprendre les coefficients',
  },
  wind: {
    body: '10 à 25 km/h de secteur mer brassent le bord sans le rendre impêchable. Au-delà de 40 km/h, c’est non.',
    href: '/guides/vent-houle-et-surfcasting',
    link: 'Vent, houle et surfcasting',
  },
  swell: {
    body: 'Entre 0,5 et 1,5 m, la mer travaille le bord. Sous 0,3 m elle est trop lisse ; au-delà de 2,5 m, la question n’est plus la pêche.',
    href: '/guides/vent-houle-et-surfcasting',
    link: 'Lire l’état de mer',
  },
  solunar: {
    body: 'Périodes majeures au zénith et au nadir, mineures au lever et au coucher. Bonus en vive-eau. Un effet réel, mais modeste.',
    href: '/guides/lune-et-periodes-solunaires',
    link: 'Ce que vaut vraiment le solunaire',
  },
  pressure: {
    body: 'La tendance, pas la valeur : une pression qui baisse précède souvent une phase active, une remontée franche derrière un front la referme.',
    href: '/guides/vent-houle-et-surfcasting',
    link: 'Lire une tendance',
  },
  water: {
    body: 'Le métabolisme d’un poisson suit celui de l’eau : trop froide il ralentit, trop chaude l’oxygène manque. Le plateau va de 11 à 22 °C — assez large pour la Bretagne comme pour Agadir.',
    href: '/guides/quand-pecher-le-bar-du-bord',
    link: 'Quand pêcher le bar',
  },
  light: {
    body: 'Aube, crépuscule et nuit devant le plein jour. Le poids est faible parce que l’effet, seul, l’est aussi.',
    href: '/guides/quand-pecher-le-bar-du-bord',
    link: 'Quand pêcher le bar',
  },
} as const;

export default async function HomePage() {
  const now = referenceNow();
  const summaries = await getAllSpotSummaries(now);
  const sources = collectSources(summaries);

  /*
    Les prévisions complètes — tous les créneaux, les marées — pour le direct.
    Elles ne coûtent rien de plus : `getSpotForecast` est mémoïsé pour la
    durée de la requête, et `getAllSpotSummaries` vient de les calculer.
  */
  const forecasts = await Promise.all(
    summaries.map((summary) => getSpotForecast(summary.spot, now)),
  );

  /*
    ─── Tout le direct est rendu PAR PAYS, un seul visible ──────────────────

    Chaque bloc `data-pays` est rendu pour les trois pays ; le serveur ne
    laisse visible que la façade par défaut, et le sélecteur remplace ce choix
    par celui qu'on a retenu. Sans script, la page montre la France ; avec,
    elle montre votre façade. Aucune requête, aucun score recalculé côté
    client.
  */
  const parPays = PAYS.map((pays) => {
    const resume = resumePays(pays, forecasts, now);
    const fiche = ficheDe(pays.slug);
    const carte: CartePays = {
      slug: pays.slug,
      nom: pays.nom,
      spots: pays.spots.length,
      regions:
        pays.regions.length <= 2
          ? pays.regions.join(', ')
          : `${pays.regions.slice(0, 2).join(', ')} +${pays.regions.length - 2}`,
      accroche: fiche.accroche.split(/(?<=\.)\s/)[0] ?? fiche.accroche,
      meilleur: resume.meilleur?.current?.score.value ?? null,
      meilleurSpot: resume.meilleur?.spot.name ?? null,
      points: pays.spots.map((spot) => ({
        slug: spot.slug,
        name: spot.name,
        lat: spot.lat,
        lng: spot.lng,
      })),
    };
    return { pays, resume, carte };
  });

  const coefficients = prochainsCoefficients(now, JOURS_DE_FRISE);
  const prochainPic = coefficients.find((jour) => jour.pic) ?? null;
  const lune = moonPhase(now);

  /*
    Les contributions publiques récentes. Le dépôt rend des listes vides
    quand les comptes ne sont pas configurés ou quand la base ne répond pas :
    la section le DIT alors, elle n'invente aucun avis de démonstration.
  */
  const recentes = await contributions.recentPublic(COMBIEN_DE_CONTRIBUTIONS);
  const parSlug = new Map(summaries.map((summary) => [summary.spot.slug, summary.spot]));
  const situer = <T extends { spotSlug: string }>(entree: T) => {
    const spot = parSlug.get(entree.spotSlug);
    return spot === undefined
      ? null
      : { ...entree, spotNom: spot.name, spotHref: spotPath(spot) };
  };
  const prisesRecentes = recentes.catches
    .map(situer)
    .filter((entree): entree is NonNullable<typeof entree> => entree !== null);
  const avisRecents = recentes.reviews
    .map(situer)
    .filter((entree): entree is NonNullable<typeof entree> => entree !== null);

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

  const faits = [
    {
      cle: 'lune',
      libelle: 'Lune',
      valeur: moonPhaseName(lune.ageDays),
      detail: `${Math.round(lune.illuminationPct)} % éclairée`,
    },
    {
      cle: 'vives-eaux',
      libelle: 'Prochaines vives-eaux',
      valeur: prochainPic
        ? formatDayLong(new Date(prochainPic.date), 'Europe/Paris')
        : 'au-delà de 30 jours',
      detail: prochainPic ? `coefficient ${prochainPic.coefficient}` : 'aucun pic sous un mois',
    },
    {
      cle: 'catalogue',
      libelle: 'Catalogue',
      valeur: `${CATALOGUE.total} spots`,
      detail: PAYS.map((pays) => pays.nom).join(', '),
    },
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      {/*
        ─── Le héros est un tableau de bord, pas une brochure ─────────────
        À gauche, ce que le site est, en une phrase, et la recherche. À
        droite, ce qu'il MONTRE : le meilleur spot de votre façade maintenant,
        sa marée, sa semaine. Un site de conditions montre des conditions.
      */}
      <div className="mx-auto w-full max-w-shell px-4 pb-4 pt-8 md:px-8 md:pt-12">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,6fr)_minmax(0,6fr)] lg:gap-12">
          <div>
            <p className="label">Pêche du bord · {CATALOGUE.etendue}</p>
            <h1 className="mt-3 max-w-[16ch] font-serif text-display font-semibold md:text-display-lg">
              Les meilleurs créneaux de pêche en mer, spot par spot
            </h1>
            <p className="mt-5 max-w-prose text-read text-fg-muted">
              Un score sur 10 par tranche de deux heures, sur sept jours, pour {CATALOGUE.total}{' '}
              spots. {FACTOR_COUNT_WORD} facteurs pondérés et expliqués — marée, vent, houle, lune,
              pression, température de l’eau, lumière — pour choisir quand y aller, pas pour vous
              promettre une prise.
            </p>

            <div className="mt-6 max-w-[42rem]">
              <SpotSearch spots={searchable} />
            </div>

            <dl className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
              {faits.map((fait) => (
                <div key={fait.cle} className="border-l-2 border-edge pl-3">
                  <dt className="text-meta text-fg-muted">{fait.libelle}</dt>
                  <dd className="mt-0.5 font-serif text-h3 font-semibold text-fg">{fait.valeur}</dd>
                  <dd className="text-meta nums text-fg-muted" data-numeric="">
                    {fait.detail}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div>
            <div className="mb-4">
              <SelecteurFacade options={PAYS.map((pays) => ({ slug: pays.slug, nom: pays.nom }))} />
            </div>
            {parPays.map(({ pays, resume }) => (
              <div key={pays.slug} data-pays={pays.slug} hidden={pays.slug !== FACADE_PAR_DEFAUT}>
                <VueDirect resume={resume} now={now} />
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8">
          <DemoDataNotice sources={sources} />
        </div>
      </div>

      <Section
        title="Ce soir, demain matin"
        lead="Le meilleur créneau de chacune des deux fenêtres où l’on pêche réellement du bord, sur votre façade. Un créneau en conditions dangereuses n’y figure jamais, quel que soit son score."
      >
        {parPays.map(({ pays, resume }) => (
          <div key={pays.slug} data-pays={pays.slug} hidden={pays.slug !== FACADE_PAR_DEFAUT}>
            {resume.moments.length === 0 ? (
              <p className="max-w-prose text-body text-fg-muted">
                Aucun créneau praticable {prepositionDe(pays)} sur ces deux fenêtres : soit elles
                sont passées, soit les conditions y sont dangereuses. Le calendrier complet reste
                sur chaque page de spot.
              </p>
            ) : (
              <>
                <ul className="grid gap-4 sm:grid-cols-2">
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
        ))}
      </Section>

      <Section
        title="Trois pays, trois façons de pêcher"
        lead="La marée, la saison, la règle et le danger changent d’un pays à l’autre. Chaque page pays dit ce qui change — et montre ses spots en direct."
      >
        <CartesPays cartes={parPays.map((entree) => entree.carte)} />

        <div className="mt-6">
          <ButtonLink href="/spots" variant="secondary">
            Tous les {CATALOGUE.total} spots, filtrables
          </ButtonLink>
        </div>

        <div className="mt-10 max-w-prose">
          {/*
            « Autour de moi » : la position reste dans le navigateur — aucun
            point d'accès serveur n'accepterait de la recevoir.
          */}
          <NearbySpots
            spots={summaries.map((summary) => ({
              slug: summary.spot.slug,
              name: summary.spot.name,
              regionLabel: summary.spot.regionName,
              path: spotPath(summary.spot),
              lat: summary.spot.lat,
              lng: summary.spot.lng,
            }))}
          />
        </div>
      </Section>

      <Section
        title="Le calendrier des coefficients"
        lead="Trente jours d’avance, pour poser un jour de congé au bon moment plutôt que pour décider ce soir. Les vives-eaux tombent deux fois par mois et se calculent un an à l’avance."
      >
        <FriseCoefficients jours={coefficients} />
        <p className="mt-4">
          <Link
            href="/marees/coefficients"
            className="inline-flex min-h-[44px] items-center text-body text-fg underline decoration-dotted underline-offset-4"
          >
            Les soixante prochains jours, mois par mois
          </Link>
        </p>
      </Section>

      <Section
        title="Ce que les pêcheurs déclarent ici"
        lead="Les dernières prises rendues publiques et les derniers avis sur les spots. Une prise reste privée tant que son auteur n’a pas coché la case."
      >
        <DernieresContributions prises={prisesRecentes} avis={avisRecents} />
      </Section>

      <Section
        title="Ce que le score regarde"
        lead={`${FACTOR_COUNT_WORD} facteurs, pondérés. Le poids compte autant que la note : un excellent score de lumière ne rattrape pas une mauvaise marée.`}
      >
        {/*
          Une liste pondérée plutôt qu'une rangée de cartes identiques : l'écart
          entre 30 % et 5 % est toute l'information de cette section.

          ─── Les poids viennent du MOTEUR, ils ne sont plus recopiés ──────
          Ils l'étaient : « 35 / 25 / 20 / 15 / 5 », cinq facteurs. Le modèle
          en comptait six depuis l'arrivée de la pression, et sept depuis
          celle de l'eau — cette page annonçait donc des pondérations que le
          score n'appliquait plus, et rien ne pouvait le signaler. Elle lit
          maintenant `FACTOR_WEIGHTS`, la seule source de vérité, et l'ORDRE
          des lignes en découle aussi.
        */}
        <ul className="divide-y divide-edge">
          {(Object.keys(EXPLICATIONS) as (keyof typeof EXPLICATIONS)[])
            .sort((a, b) => FACTOR_WEIGHTS[b] - FACTOR_WEIGHTS[a])
            .map((facteur) => {
              const entree = EXPLICATIONS[facteur];
              const poids = Math.round(FACTOR_WEIGHTS[facteur] * 100);
              const maximum = Math.round(Math.max(...Object.values(FACTOR_WEIGHTS)) * 100);

              return (
                <li key={facteur} className="py-6">
                  <div className="flex items-baseline gap-4">
                    <span
                      className="w-16 shrink-0 nums font-serif text-h1 font-semibold text-fg"
                      data-numeric=""
                    >
                      {poids}
                      <span className="text-body font-500 text-fg-faint"> %</span>
                    </span>
                    <h3 className="text-body font-semibold font-600">{FACTOR_LABELS[facteur]}</h3>
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
      </Section>
    </>
  );
}
