import type { Metadata } from 'next';
import Link from 'next/link';

import { LegalDraftNotice, LegalValue } from '@/components/legal/LegalValue';
import { CLIENT_STORAGE, CNIL, LEGAL_UPDATED, PROCESSORS, PUBLISHER } from '@/data/legal';
import { absoluteUrl } from '@/lib/routes';
import { formatDateLong } from '@/lib/time';

export const metadata: Metadata = {
  title: 'Politique de confidentialité',
  description:
    'Ce que Moonfish collecte — une adresse e-mail si vous la donnez, rien d’autre —, pourquoi, pendant combien de temps, et comment exercer vos droits.',
  alternates: { canonical: absoluteUrl('/confidentialite') },
};

/** Chaque ligne du tableau des traitements. Une colonne « base légale » vide serait un aveu. */
const TREATMENTS = [
  {
    what: 'Liste d’attente',
    data: 'Votre adresse e-mail, la page depuis laquelle vous l’avez saisie, la date et l’heure.',
    why: 'Vous prévenir quand les fonctions annoncées ouvrent. Rien d’autre : pas de lettre d’information, pas de relance commerciale.',
    basis: 'Votre consentement, donné en envoyant le formulaire, retirable à tout moment.',
    keep: 'Jusqu’à l’ouverture annoncée, ou jusqu’à votre demande de suppression si elle vient avant. Au plus tard trois ans après votre inscription.',
  },
  {
    what: 'Protection du formulaire',
    data: 'Une empreinte de votre adresse IP (SHA-256 tronquée), jamais l’adresse elle-même.',
    why: 'Limiter à cinq envois par quart d’heure, pour qu’un script ne remplisse pas la liste.',
    basis: 'Notre intérêt légitime à protéger un formulaire public des envois automatisés.',
    keep: 'En mémoire vive seulement, un quart d’heure glissant. Rien n’est écrit sur disque, et un redémarrage efface tout.',
  },
  {
    what: 'Journaux d’hébergement',
    data: 'Adresse IP, date, page demandée, type de navigateur — enregistrés par l’hébergeur, pas par nous.',
    why: 'Faire fonctionner le site, diagnostiquer une panne, repérer un abus.',
    basis: 'Notre intérêt légitime à la sécurité et au bon fonctionnement du service.',
    keep: 'Selon la politique de rétention de l’hébergeur, de l’ordre de quelques jours à un mois. Nous ne les consultons qu’en cas d’incident.',
  },
] as const;

export default function ConfidentialitePage() {
  return (
    <div className="bg-page">
      <div className="mx-auto w-full max-w-shell px-4 py-8 md:px-8 md:py-12">
        <h1 className="font-serif text-h1 font-semibold">Politique de confidentialité</h1>
        <p className="mt-3 max-w-prose text-read text-fg-muted">
          Dernière révision le{' '}
          <time dateTime={LEGAL_UPDATED} className="nums">
            {formatDateLong(new Date(LEGAL_UPDATED), 'Europe/Paris')}
          </time>
          . Cette page décrit ce que le site fait <em>aujourd’hui</em>, pas ce qu’il fera. Elle sera
          mise à jour avant l’ouverture de toute nouvelle collecte, pas après.
        </p>

        <LegalDraftNotice />

        <section aria-labelledby="resume" className="mt-10 max-w-prose">
          <h2 id="resume" className="font-serif text-h2 font-semibold">
            En une phrase
          </h2>
          <p className="mt-3 text-read text-fg-muted">
            Moonfish ne collecte rien tant que vous ne saisissez rien. Il n’y a ni compte, ni
            mesure d’audience, ni publicité, ni traceur, ni cookie. La seule donnée personnelle que
            nous conservons est l’adresse e-mail que vous nous laissez, si vous nous la laissez.
          </p>
        </section>

        <section aria-labelledby="responsable" className="mt-10 max-w-prose">
          <h2 id="responsable" className="font-serif text-h2 font-semibold">
            Responsable du traitement
          </h2>
          <p className="mt-3 text-read text-fg">
            <LegalValue value={PUBLISHER.name} hint="identité de l’éditeur" />
            {PUBLISHER.address !== null && <>, {PUBLISHER.address}</>}.
          </p>
          <p className="mt-2 text-read text-fg-muted">
            Contact pour toute question ou pour exercer vos droits :{' '}
            {PUBLISHER.email !== null ? (
              <a
                href={`mailto:${PUBLISHER.email}`}
                className="underline decoration-dotted underline-offset-4"
              >
                {PUBLISHER.email}
              </a>
            ) : (
              <LegalValue value={null} hint="adresse e-mail de contact" />
            )}
            . Aucun délégué à la protection des données n’a été désigné : les traitements décrits
            ici ne remplissent aucun des cas où la désignation est obligatoire.
          </p>
        </section>

        <section aria-labelledby="traitements" className="mt-10">
          <h2 id="traitements" className="font-serif text-h2 font-semibold">
            Ce que nous traitons, et à quel titre
          </h2>
          <p className="mt-2 max-w-prose text-read text-fg-muted">
            Trois traitements, et la liste est exhaustive. S’il y en avait un quatrième, il serait
            écrit ici.
          </p>

          <ul className="mt-6 grid gap-4 lg:grid-cols-3">
            {TREATMENTS.map((item) => (
              <li key={item.what} className="surface p-4">
                <h3 className="card-title">{item.what}</h3>
                <dl className="mt-3 space-y-3">
                  {[
                    ['Données', item.data],
                    ['Finalité', item.why],
                    ['Base légale', item.basis],
                    ['Durée', item.keep],
                  ].map(([term, value]) => (
                    <div key={term}>
                      <dt className="text-meta text-fg-muted">{term}</dt>
                      <dd className="mt-1 text-body text-fg">{value}</dd>
                    </div>
                  ))}
                </dl>
              </li>
            ))}
          </ul>

          <p className="demo-frame mt-4 max-w-prose px-4 py-3 text-body text-fg-muted">
            <strong className="font-600 text-fg">Une limite que nous préférons écrire.</strong> Les
            inscriptions à la liste d’attente sont aujourd’hui enregistrées sur un support
            temporaire, remis à zéro à chaque mise à jour du site. Concrètement, votre adresse peut
            disparaître d’elle-même — c’est une faiblesse pour nous, pas pour vous, et il vaut mieux
            que vous le sachiez que de croire à une conservation qui n’existe pas encore. Le
            passage à une base durable s’accompagnera de la mise à jour de cette page.
          </p>
        </section>

        <section aria-labelledby="cookies" className="mt-10">
          <h2 id="cookies" className="font-serif text-h2 font-semibold">
            Cookies et stockage du navigateur
          </h2>
          <p className="mt-2 max-w-prose text-read text-fg-muted">
            Le site ne dépose <strong className="font-600 text-fg">aucun cookie</strong>. Il n’y a
            donc pas de bandeau de consentement : il n’y aurait rien à consentir. Voici, en
            revanche, tout ce que le site écrit dans votre navigateur.
          </p>

          <ul className="mt-4 space-y-3">
            {CLIENT_STORAGE.map((entry) => (
              <li key={entry.key} className="surface max-w-prose p-4">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h3 className="text-body font-600 text-fg nums">{entry.key}</h3>
                  <span className="rounded-ctl bg-surface-2 px-1.5 py-0.5 text-meta text-fg">
                    {entry.kind}
                  </span>
                </div>
                <p className="mt-2 text-read text-fg-muted">{entry.purpose}</p>
                <p className="mt-1 text-body text-fg-muted">{entry.retention}</p>
                <p className="card-source mt-3">
                  {entry.consentRequired
                    ? 'Soumis à votre consentement préalable.'
                    : 'Dispensé de consentement : il enregistre une préférence que vous avez vous-même exprimée, et ne sert à aucun suivi.'}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="tiers" className="mt-10">
          <h2 id="tiers" className="font-serif text-h2 font-semibold">
            Qui reçoit quoi
          </h2>
          <p className="mt-2 max-w-prose text-read text-fg-muted">
            Nous ne vendons ni ne louons aucune donnée, et n’en transmettons à personne à des fins
            publicitaires. Les seuls tiers en jeu sont ceux qui font tourner le site.
          </p>

          <ul className="mt-4 grid gap-4 lg:grid-cols-3">
            {PROCESSORS.map((processor) => (
              <li key={processor.name} className="surface p-4">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h3 className="text-body font-600 text-fg">{processor.name}</h3>
                  <span className="rounded-ctl bg-surface-2 px-1.5 py-0.5 text-meta text-fg">
                    {processor.browserContact
                      ? 'contacté par votre navigateur'
                      : 'contacté par notre serveur'}
                  </span>
                </div>
                <p className="mt-2 text-read text-fg-muted">{processor.role}</p>
                <p className="mt-1 text-body text-fg-muted">{processor.data}</p>
                <p className="card-source mt-3">{processor.location}</p>
              </li>
            ))}
          </ul>

          <p className="mt-4 max-w-prose text-body text-fg-muted">
            La distinction porte à conséquence : les appels de marée et de météo partent de{' '}
            <em>notre</em> serveur, jamais de votre navigateur. Ni Stormglass ni Open-Meteo ne
            voient donc votre adresse IP, et ne peuvent pas savoir quel spot vous consultez. Les
            polices de caractères sont hébergées avec le site, pas chargées depuis un service
            extérieur : en dehors de l’hébergeur, aucune requête ne quitte votre navigateur vers un
            tiers. L’hébergement se faisant aux États-Unis, ce transfert s’appuie sur les clauses
            contractuelles types de la Commission européenne.
          </p>
        </section>

        <section aria-labelledby="absents" className="mt-10 max-w-prose">
          <h2 id="absents" className="font-serif text-h2 font-semibold">
            Ce que nous ne faisons pas
          </h2>
          <ul className="mt-3 space-y-2">
            {[
              'Aucun compte utilisateur : il n’y a rien à créer, rien à connecter.',
              'Aucune mesure d’audience, aucun outil d’analyse, aucun pixel de suivi.',
              'Aucune publicité, aucun lien rémunéré, aucun revendeur de données.',
              'Aucune géolocalisation : le site ne demande jamais votre position.',
              'Aucun profilage, aucune décision automatisée vous concernant.',
            ].map((line) => (
              <li key={line} className="text-read text-fg-muted">
                {line}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-read text-fg-muted">
            Cette liste se vérifie : elle est tenue par des tests qui échouent si un stockage, une
            requête vers un tiers ou un traceur apparaît dans le code sans être déclaré sur cette
            page.
          </p>
        </section>

        <section aria-labelledby="avenir" className="mt-10 max-w-prose">
          <h2 id="avenir" className="font-serif text-h2 font-semibold">
            Les fonctions annoncées, et les règles déjà fixées
          </h2>
          <p className="mt-3 text-read text-fg-muted">
            Des comptes, des avis sur les spots et un carnet de prises sont en préparation. Rien de
            tout cela n’est en service : aucun de ces traitements n’existe aujourd’hui. Trois
            décisions sont néanmoins déjà prises, et cette page les inscrit maintenant pour qu’on
            puisse nous les opposer plus tard.
          </p>
          <ul className="mt-3 space-y-2">
            {[
              'La position de votre appareil, si vous l’autorisez un jour pour trouver les spots proches, sera utilisée dans le navigateur et ne sera pas envoyée à nos serveurs. Une position de pêcheur est une information sensible.',
              'Les photos de prises seront débarrassées de leurs métadonnées avant enregistrement. Une photo de téléphone porte les coordonnées GPS de la prise — donc, parfois, celles d’un spot que vous vouliez garder, ou de votre domicile.',
              'Toute mesure d’audience, si elle arrive, sera soit sans cookie et sans identifiant, soit soumise à votre consentement préalable et explicite. Pas de bandeau qui pré-coche.',
            ].map((line) => (
              <li key={line} className="text-read text-fg-muted">
                {line}
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="droits" className="mt-10 max-w-prose">
          <h2 id="droits" className="font-serif text-h2 font-semibold">
            Vos droits
          </h2>
          <p className="mt-3 text-read text-fg-muted">
            Vous pouvez demander l’accès à vos données, leur rectification, leur effacement, la
            limitation de leur traitement, leur portabilité, et vous opposer à un traitement fondé
            sur notre intérêt légitime. Le consentement donné pour la liste d’attente se retire
            aussi simplement qu’il a été donné, et son retrait ne remet pas en cause ce qui a été
            fait avant.
          </p>
          <p className="mt-3 text-read text-fg-muted">
            En pratique, un message à{' '}
            {PUBLISHER.email !== null ? (
              <a
                href={`mailto:${PUBLISHER.email}`}
                className="underline decoration-dotted underline-offset-4"
              >
                {PUBLISHER.email}
              </a>
            ) : (
              <LegalValue value={null} hint="adresse e-mail de contact" />
            )}{' '}
            suffit : nous n’avons qu’une adresse e-mail à votre sujet, et la supprimer nous prend
            moins d’une minute. Réponse sous un mois. Nous ne vous demanderons pas de pièce
            d’identité pour effacer une adresse e-mail — ce serait collecter davantage pour
            supprimer moins.
          </p>
          <p className="mt-3 text-read text-fg-muted">
            Si notre réponse ne vous convient pas, vous pouvez saisir la {CNIL.name},{' '}
            {CNIL.address}, ou déposer une plainte sur{' '}
            <a
              href={CNIL.site}
              className="underline decoration-dotted underline-offset-4"
              rel="noopener noreferrer"
              target="_blank"
            >
              cnil.fr
            </a>
            .
          </p>
        </section>

        <section aria-labelledby="mineurs" className="mt-10 max-w-prose">
          <h2 id="mineurs" className="font-serif text-h2 font-semibold">
            Mineurs
          </h2>
          <p className="mt-3 text-read text-fg-muted">
            Le site est consultable par tous et ne demande aucune donnée pour être lu. Le
            formulaire de liste d’attente ne s’adresse pas aux moins de quinze ans. Si une adresse
            appartenant à un mineur nous parvenait, elle serait supprimée sur simple signalement.
          </p>
        </section>

        <section aria-labelledby="revisions" className="mt-10 max-w-prose">
          <h2 id="revisions" className="font-serif text-h2 font-semibold">
            Modifications
          </h2>
          <p className="mt-3 text-read text-fg-muted">
            Cette page change quand le site change. La date de révision en tête indique la dernière
            modification. Les personnes inscrites à la liste d’attente seront prévenues par e-mail
            avant toute nouvelle utilisation de leur adresse. Voir aussi les{' '}
            <Link
              href="/mentions-legales"
              className="underline decoration-dotted underline-offset-4"
            >
              mentions légales
            </Link>{' '}
            et{' '}
            <Link href="/donnees" className="underline decoration-dotted underline-offset-4">
              la page des sources
            </Link>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
