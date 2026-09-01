import type { Metadata } from 'next';
import Link from 'next/link';

import { validityHoursOf } from '@/lib/data-freshness';
import { ASTRO_SOURCE, tides, weather } from '@/lib/providers';
import { absoluteUrl } from '@/lib/routes';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'D’où viennent les données',
  description:
    'Les sources de Moonfish, ce que chacune sait faire, ce qu’elle ne sait pas faire, et ce que veulent dire les mentions « à jour », « ancien », « interrompu » et « en attente ».',
  alternates: { canonical: absoluteUrl('/donnees') },
};

const KIND_LABEL = {
  measured: 'Relevé',
  forecast: 'Prévision',
  computed: 'Calculé',
  simulated: 'Simulé',
} as const;

const BLOCKS = [
  {
    label: 'Marées et coefficients',
    source: tides.source,
    validity: validityHoursOf(tides.source),
    note: 'Les horaires de marée sont de l’astronomie : ils sont prédits des mois à l’avance et ne se réactualisent pas d’heure en heure. Ils sont donc mis en cache 24 à 72 h, et une table de la veille n’a rien perdu de sa justesse. Le coefficient affiché est le coefficient FRANÇAIS, rapporté au marnage de Brest selon la définition du SHOM.',
  },
  {
    label: 'Vent, houle et état de mer',
    source: weather.source,
    validity: validityHoursOf(weather.source),
    note: 'Une prévision météo est révisée plusieurs fois par jour. C’est la donnée qui se périme le plus vite du site, et celle qu’il faut recouper avant de partir.',
  },
  {
    label: 'Soleil et Lune',
    source: ASTRO_SOURCE,
    validity: validityHoursOf(ASTRO_SOURCE),
    note: 'Recalculé à chaque affichage à partir de la position du spot. Ne dépend d’aucun réseau, ne peut donc ni tomber ni vieillir.',
  },
] as const;

const STATES = [
  {
    label: 'À jour',
    colorVar: 'var(--accent)',
    text: 'La donnée est dans sa fenêtre de validité, celle indiquée pour son bloc.',
  },
  {
    label: 'Ancien',
    colorVar: 'var(--warn)',
    text: 'La fenêtre est dépassée sans renouvellement. Ce qui est affiché reste probablement correct, mais nous ne le garantissons plus.',
  },
  {
    label: 'Interrompu',
    colorVar: 'var(--danger)',
    text: 'Le fournisseur réel n’a pas répondu et nous affichons un repli simulé. Les valeurs sont inventées et ne décrivent aucune condition réelle.',
  },
  {
    label: 'En attente',
    colorVar: 'var(--fg-muted)',
    text: 'Nous ne savons pas de quand date cette donnée. Ce n’est pas la même chose qu’à jour, et nous refusons de l’écrire ainsi.',
  },
] as const;

export default function DonneesPage() {
  return (
    <div className="mx-auto w-full max-w-shell px-4 py-8 md:px-8 md:py-12">
      <h1 className="font-serif text-h1 font-semibold">D’où viennent les données</h1>

      <p className="mt-4 max-w-prose text-body text-fg-muted">
        Moonfish calcule un score à partir de sources extérieures. Aucune n’est parfaite, et une
        page qui prétendrait le contraire vous serait moins utile qu’une page qui dit ce qu’elle ne
        sait pas. Cette page dit, bloc par bloc, d’où vient ce que vous lisez et jusqu’à quand nous
        le considérons valable.
      </p>

      <section aria-labelledby="blocs" className="mt-10">
        <h2 id="blocs" className="font-serif text-h2 font-semibold">
          Les trois blocs
        </h2>

        <p className="mt-2 max-w-prose text-body text-fg-muted">
          Ce sont les fournisseurs <em>configurés</em>. Un fournisseur peut tomber sur un spot et
          pas sur un autre : c’est la page du spot qui dit ce qui a réellement servi à ce
          moment-là, bloc par bloc. Quand la mention y passe à <em>Simulé</em> ou que la puce
          affiche <em>Interrompu</em>, c’est cette page-là qui a raison, pas celle-ci.
        </p>

        <ul className="mt-4 space-y-4">
          {BLOCKS.map(({ label, source, validity, note }) => (
            <li key={label} className="surface p-4">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h3 className="text-body font-600 text-fg">{label}</h3>
                <span className="rounded-ctl bg-surface-2 px-1.5 py-0.5 text-meta font-600 text-fg">
                  {KIND_LABEL[source.kind]}
                </span>
              </div>

              <p className="mt-2 max-w-prose text-body text-fg-muted">{source.name}</p>
              <p className="mt-1 max-w-prose text-meta nums text-fg-faint">{source.precision}</p>
              <p className="mt-3 max-w-prose text-body text-fg-muted">{note}</p>

              <p className="mt-3 text-meta nums text-fg-faint" data-numeric="">
                {validity === null
                  ? 'Sans péremption : rien à rafraîchir.'
                  : validity >= 48
                    ? `Considéré à jour pendant ${validity / 24} jours après le relevé.`
                    : `Considéré à jour pendant ${validity} h après le relevé.`}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="etats" className="mt-10">
        <h2 id="etats" className="font-serif text-h2 font-semibold">
          Ce que veut dire la puce de fraîcheur
        </h2>
        <p className="mt-2 max-w-prose text-body text-fg-muted">
          Chaque bloc porte une puce. Elle est calculée dans votre navigateur, contre votre horloge :
          une page peut être servie depuis un cache, la puce, elle, dit l’âge réel de ce que vous
          avez sous les yeux.
        </p>

        <dl className="mt-4 space-y-3">
          {STATES.map(({ label, colorVar, text }) => (
            <div key={label} className="surface p-4">
              <dt className="flex items-center gap-2">
                <span
                  className="inline-block h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: colorVar }}
                  aria-hidden="true"
                />
                <span className="text-body font-600 text-fg">{label}</span>
              </dt>
              <dd className="mt-1 max-w-prose text-body text-fg-muted">{text}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="limites" className="mt-10">
        <h2 id="limites" className="font-serif text-h2 font-semibold">
          Ce que Moonfish ne sait pas faire
        </h2>
        <ul className="mt-4 max-w-prose space-y-2 text-body text-fg-muted">
          <li>
            <strong className="font-600 text-fg">Ce n’est pas un service de sécurité.</strong> Le
            bandeau de danger se déclenche au-delà de 2,5 m de houle ou 50 km/h de vent, mais
            l’absence de bandeau ne veut pas dire que la mer est praticable. Un coup de vent local,
            une baïne ou un estran glissant n’apparaissent dans aucune donnée.
          </li>
          <li>
            <strong className="font-600 text-fg">Le coefficient est français.</strong> Il est
            rapporté au marnage de Brest, définition du SHOM. Sur les spots hors de France, il est
            affiché à titre indicatif et ne correspond à aucun usage local.
          </li>
          <li>
            <strong className="font-600 text-fg">Aucune promesse de prise.</strong> Le score décrit
            des conditions, pas des poissons. Un créneau à 9 sur 10 reste une sortie où l’on peut
            rentrer bredouille.
          </li>
          <li>
            <strong className="font-600 text-fg">Une source qui manque n’est jamais remplacée.</strong>{' '}
            Si un fournisseur tombe, le facteur concerné sort du calcul, les poids sont
            renormalisés, et le score le dit sous forme de phrase. Il n’est jamais complété par une
            valeur par défaut.
          </li>
        </ul>
      </section>

      <section aria-labelledby="officiel" className="mt-10">
        <h2 id="officiel" className="font-serif text-h2 font-semibold">
          Les références officielles
        </h2>
        <p className="mt-2 max-w-prose text-body text-fg-muted">
          Avant une sortie réelle, ce sont elles qui font foi :{' '}
          <a
            href="https://maree.shom.fr"
            className="underline decoration-dotted underline-offset-4"
            rel="noopener noreferrer"
            target="_blank"
          >
            maree.shom.fr
          </a>{' '}
          pour les horaires de marée,{' '}
          <a
            href="https://meteofrance.com/meteo-marine"
            className="underline decoration-dotted underline-offset-4"
            rel="noopener noreferrer"
            target="_blank"
          >
            meteofrance.com
          </a>{' '}
          pour le bulletin marine.
        </p>
        <p className="mt-6">
          <Link href="/spots" className="underline decoration-dotted underline-offset-4">
            Retour aux spots
          </Link>
        </p>
      </section>
    </div>
  );
}
