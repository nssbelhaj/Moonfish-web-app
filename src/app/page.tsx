import type { Metadata } from 'next';
import Link from 'next/link';

import { CATALOGUE, PAYS } from '@/data/spots';
import { ChoixPays, type OptionPays } from '@/components/accueil/ChoixPays';
import { CarteMoment } from '@/components/accueil/CarteMoment';
import { DernieresContributions } from '@/components/accueil/DernieresContributions';
import { FriseCoefficients } from '@/components/accueil/FriseCoefficients';
import { DemoDataNotice } from '@/components/data/DemoDataNotice';
import { EmailCaptureForm } from '@/components/forms/EmailCaptureForm';
import { SpotSearch, type SearchableSpot } from '@/components/forms/SpotSearch';
import { ScoreBreakdown } from '@/components/score/ScoreBreakdown';
import { NearbySpots } from '@/components/spot/NearbySpots';
import { ButtonLink } from '@/components/ui/Button';
import { Section } from '@/components/ui/Section';
import {
  collectSources,
  getAllSpotSummaries,
  getSpotForecast,
  referenceNow,
} from '@/lib/forecast';
import { prochainsCoefficients } from '@/lib/forecast/coefficients';
import { momentsFor, type Moment } from '@/lib/forecast/moments';
import { contributions, tides, weather } from '@/lib/providers';
import { absoluteUrl, spotPath } from '@/lib/routes';
import {
  FACTOR_COUNT_WORD,
  FACTOR_LABELS,
  FACTOR_WEIGHTS,
  factorWeightSentence,
} from '@/lib/scoring';

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
    Les prévisions complètes, pour disposer de TOUS les créneaux et pas
    seulement du meilleur. Elles ne coûtent rien de plus : `getSpotForecast`
    est mémoïsé pour la durée de la requête, et `getAllSpotSummaries` vient
    de les calculer.
  */
  const previsions = await Promise.all(
    summaries.map(async (summary) => ({
      spot: summary.spot,
      days: (await getSpotForecast(summary.spot, now)).days,
    })),
  );

  /*
    ─── Tout est groupé PAR PAYS ────────────────────────────────────────────

    L'accueil classait les créneaux sur le catalogue entier. Pour quelqu'un
    qui pêche en Bretagne, cela donnait régulièrement trois spots marocains :
    exacts, bien classés, et sans le moindre usage. On rend donc les trois
    pays, chacun dans son bloc `data-pays`, et le sélecteur masque les
    autres. Sans JavaScript, les trois restent lisibles sous leur titre.
  */
  const parPays = PAYS.map((pays) => {
    const slugs = new Set(pays.spots.map((spot) => spot.slug));
    const previsionsDuPays = previsions.filter((entree) => slugs.has(entree.spot.slug));
    const resumes = summaries.filter((summary) => slugs.has(summary.spot.slug));
    const meilleur = resumes.find((summary) => summary.current?.score.value != null) ?? null;

    return {
      pays,
      moments: momentsFor(previsionsDuPays, now),
      option: {
        slug: pays.slug,
        nom: pays.nom,
        spots: pays.spots.length,
        meilleur: meilleur?.current?.score.value ?? null,
        meilleurSpot: meilleur?.spot.name ?? null,
        /*
          Deux régions nommées, puis le compte de celles qui restent. Trois
          noms débordaient de la carte et l'ellipse CSS les coupait au milieu
          d'un mot — « Tanger-Tétoua… » — ce qui cachait en plus combien il
          en restait.
        */
        regions:
          pays.regions.length <= 2
            ? pays.regions.join(', ')
            : `${pays.regions.slice(0, 2).join(', ')} +${pays.regions.length - 2}`,
        points: pays.spots.map((spot) => ({
          slug: spot.slug,
          name: spot.name,
          lat: spot.lat,
          lng: spot.lng,
        })),
      } satisfies OptionPays,
    };
  });

  const coefficients = prochainsCoefficients(now, JOURS_DE_FRISE);

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
        title="Où pêchez-vous ?"
        lead="Choisissez une façade : le reste de la page s’y limite, et votre choix est retenu pour la prochaine visite. Les points de chaque vignette sont les spots, à leurs vraies coordonnées."
      >
        <ChoixPays options={parPays.map((entree) => entree.option)} />

        <div className="mt-8 max-w-prose">
          {/*
            « Autour de moi » remonte ici depuis /spots : c'est la question la
            plus fréquente, et elle ne demande rien tant qu'on ne clique pas.
            La position reste dans le navigateur — aucun point d'accès serveur
            n'accepterait de la recevoir.
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
        title="Ce soir, demain matin"
        lead="Le meilleur créneau de chacune des deux fenêtres où l’on pêche réellement du bord — pas un classement du catalogue. Un créneau en conditions dangereuses n’y figure jamais, quel que soit son score."
      >
        <div className="space-y-8">
          {parPays.map(({ pays, moments }) => (
            <div key={pays.slug} data-pays={pays.slug}>
              <h3 className="text-h3 font-semibold font-600" data-titre-pays="">
                {pays.nom}
              </h3>

              {moments.length === 0 ? (
                <p className="mt-3 max-w-prose text-body text-fg-muted">
                  Aucun créneau praticable {pays.nom === 'France' ? 'en France' : `— ${pays.nom}`}{' '}
                  sur ces deux fenêtres : soit elles sont passées, soit les conditions y sont
                  dangereuses. Le calendrier complet reste sur chaque page de spot.
                </p>
              ) : (
                <>
                  <ul className="mt-3 grid gap-4 sm:grid-cols-2">
                    {moments.map((moment) => (
                      <li key={moment.cle}>
                        <CarteMoment moment={moment} />
                      </li>
                    ))}
                  </ul>

                  <PourquoiCeScore moment={moments[0]!} />
                </>
              )}
            </div>
          ))}
        </div>

        <div className="mt-8">
          <ButtonLink href="/spots" variant="secondary">
            Voir les {CATALOGUE.total} spots
          </ButtonLink>
        </div>
      </Section>

      <Section
        title="Le calendrier des coefficients"
        lead="Trente jours d’avance, pour poser un jour de congé au bon moment plutôt que pour décider ce soir. Les vives-eaux tombent deux fois par mois et se calculent un an à l’avance."
      >
        <FriseCoefficients jours={coefficients} />
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
          Une liste pondérée plutôt qu'une rangée de cartes identiques.
          Quatre cartes côte à côte, c'est la mise en page générique par défaut —
          et surtout elle rendait les poids indiscernables, alors que l'écart
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

/**
 * Le détail du calcul du créneau mis en avant, dépliable.
 *
 * ─── Pourquoi ici, et pourquoi replié ─────────────────────────────────────
 *
 * « Faites-nous confiance, c'est 8,4 » est exactement ce que fait un site
 * concurrent. La page d'accueil peut montrer le calcul qui vient de produire
 * le chiffre au-dessus : c'est la démonstration de la promesse, sur une
 * donnée réelle, avant même d'ouvrir une page de spot.
 *
 * Replié dans un `<details>` : déployé, il ferait quarante lignes de tableau
 * à la place du contenu, et il n'a pas besoin de JavaScript pour s'ouvrir.
 */
function PourquoiCeScore({ moment }: { moment: Moment }) {
  return (
    <details className="mt-4 rounded-card border border-edge bg-card px-4 py-2">
      {/*
        Le marqueur natif est CONSERVÉ : sans lui, rien n'indique que la ligne
        s'ouvre, et une ligne cliquable qui ne se signale pas n'est pas
        cliquée. D'où l'absence de `list-none` — et l'absence de `flex` :
        donner à un `summary` un `display` autre que `list-item` fait
        disparaître le triangle, ce qui revient au même. La hauteur de cible
        vient donc du `py-3`, pas d'un `items-center`.
      */}
      <summary className="cursor-pointer py-3 text-body font-600 text-fg marker:text-fg-muted">
        Pourquoi ce score ? Le détail du calcul pour {moment.spot.name}
      </summary>

      <div className="mt-4">
        <ScoreBreakdown score={moment.slot.score} />
      </div>
    </details>
  );
}
