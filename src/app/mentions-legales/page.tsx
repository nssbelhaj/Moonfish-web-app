import type { Metadata } from 'next';
import Link from 'next/link';

import { LegalDraftNotice, LegalValue } from '@/components/legal/LegalValue';
import { HOST, LEGAL_UPDATED, PUBLISHER } from '@/data/legal';
import { absoluteUrl } from '@/lib/routes';
import { formatDateLong } from '@/lib/time';

export const metadata: Metadata = {
  title: 'Mentions légales',
  description:
    'Éditeur, directeur de la publication, hébergeur et conditions d’utilisation de Moonfish, avec ce que le site garantit et ce qu’il ne garantit pas.',
  alternates: { canonical: absoluteUrl('/mentions-legales') },
};

export default function MentionsLegalesPage() {
  return (
    <div className="bg-page">
      <div className="mx-auto w-full max-w-shell px-4 py-8 md:px-8 md:py-12">
        <h1 className="font-serif text-h1 font-semibold">Mentions légales</h1>
        <p className="mt-3 max-w-prose text-read text-fg-muted">
          Qui publie ce site, qui l’héberge, et ce que vous pouvez en attendre. Dernière révision
          le{' '}
          <time dateTime={LEGAL_UPDATED} className="nums">
            {formatDateLong(new Date(LEGAL_UPDATED), 'Europe/Paris')}
          </time>
          .
        </p>

        <LegalDraftNotice />

        <section aria-labelledby="editeur" className="mt-10">
          <h2 id="editeur" className="font-serif text-h2 font-semibold">
            Éditeur du site
          </h2>

          <dl className="surface mt-4 divide-y divide-edge p-4">
            {[
              { term: 'Éditeur', value: PUBLISHER.name, hint: 'nom ou raison sociale' },
              { term: 'Forme juridique', value: PUBLISHER.legalForm, hint: 'statut de l’éditeur' },
              { term: 'Adresse', value: PUBLISHER.address, hint: 'adresse postale complète' },
              { term: 'Contact', value: PUBLISHER.email, hint: 'adresse e-mail publiée' },
              { term: 'Téléphone', value: PUBLISHER.phone, hint: 'obligatoire pour un éditeur professionnel' },
              { term: 'Immatriculation', value: PUBLISHER.registration, hint: 'SIREN, SIRET ou RCS le cas échéant' },
              { term: 'TVA intracommunautaire', value: PUBLISHER.vat, hint: 'si assujetti' },
              {
                term: 'Directeur de la publication',
                value: PUBLISHER.publicationDirector,
                hint: 'représentant légal de l’éditeur',
              },
            ].map(({ term, value, hint }) => (
              <div key={term} className="flex flex-col gap-1 py-2 sm:flex-row sm:gap-4">
                <dt className="text-meta text-fg-muted sm:w-64 sm:shrink-0">{term}</dt>
                <dd className="text-read text-fg">
                  <LegalValue value={value} hint={hint} />
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section aria-labelledby="hebergeur" className="mt-10 max-w-prose">
          <h2 id="hebergeur" className="font-serif text-h2 font-semibold">
            Hébergeur
          </h2>
          <p className="mt-3 text-read text-fg-muted">
            {HOST.name}, {HOST.address}.{' '}
            <a
              href={HOST.contact}
              className="underline decoration-dotted underline-offset-4"
              rel="noopener noreferrer"
              target="_blank"
            >
              Contacter l’hébergeur
            </a>
            . Les pages sont servies depuis les serveurs de cette société ; les journaux techniques
            qu’elle conserve sont décrits dans la{' '}
            <Link
              href="/confidentialite"
              className="underline decoration-dotted underline-offset-4"
            >
              politique de confidentialité
            </Link>
            .
          </p>
        </section>

        <section aria-labelledby="objet" className="mt-10 max-w-prose">
          <h2 id="objet" className="font-serif text-h2 font-semibold">
            Ce que fait ce site, et ce qu’il ne fait pas
          </h2>
          <p className="mt-3 text-read text-fg-muted">
            Moonfish calcule une note de 0 à 10 par créneau de deux heures, à partir de la marée,
            du vent, de la houle, de la pression, de la lumière et des périodes solunaires. Cette
            note est une aide à la décision, rien de plus. Elle ne prédit aucune prise, et personne
            ne peut le faire : nous n’écrivons nulle part le contraire.
          </p>
          <p className="mt-3 text-read text-fg-muted">
            Le site ne remplace ni les annuaires de marée officiels du SHOM, ni le bulletin marine
            de Météo-France. Avant une sortie, ce sont eux qui font foi — et non nous.{' '}
            <Link href="/donnees" className="underline decoration-dotted underline-offset-4">
              La page des sources
            </Link>{' '}
            indique, bloc par bloc, d’où vient chaque valeur affichée et jusqu’à quand nous la
            considérons valable.
          </p>
        </section>

        <section aria-labelledby="responsabilite" className="mt-10 max-w-prose">
          <h2 id="responsabilite" className="font-serif text-h2 font-semibold">
            Responsabilité
          </h2>
          <p className="mt-3 text-read text-fg-muted">
            La pêche du bord se pratique dans un milieu qui blesse et qui tue. Les bandeaux de
            danger affichés par le site — houle au-delà de 2,5 m, vent au-delà de 50 km/h — sont un
            garde-fou grossier, pas une expertise : une mer sous ces seuils peut rester
            dangereuse, un coup de mer local ne figure dans aucune prévision, et une roche
            découverte à marée basse est submergée deux heures plus tard. La décision de partir,
            de rester ou de rentrer vous appartient entièrement, et vous en assumez seul les
            conséquences.
          </p>
          <p className="mt-3 text-read text-fg-muted">
            Les données proviennent de tiers et peuvent être indisponibles, retardées ou fausses.
            Nous nous engageons à le signaler quand nous le savons — c’est le rôle des mentions de
            fraîcheur et des repères « simulé » — pas à garantir l’exactitude de ce que ces tiers
            publient.
          </p>
          <p className="mt-3 text-read text-fg-muted">
            Le respect de la réglementation de la pêche de loisir vous incombe : tailles minimales
            de capture, quotas journaliers, périodes de fermeture, zones interdites, marquage des
            captures. Les tailles que le site rappelle sont données à titre indicatif, d’après
            l’arrêté du 26 octobre 2012 à jour de ses révisions ; une réglementation locale peut
            être plus stricte, et c’est elle qui s’applique.
          </p>
        </section>

        <section aria-labelledby="propriete" className="mt-10 max-w-prose">
          <h2 id="propriete" className="font-serif text-h2 font-semibold">
            Propriété intellectuelle
          </h2>
          <p className="mt-3 text-read text-fg-muted">
            Les textes, guides, illustrations, graphiques et la mise en forme du site sont
            protégés. Leur reproduction sur un autre support suppose l’accord préalable de
            l’éditeur, à l’exception des courtes citations accompagnées d’un lien vers la page
            d’origine.
          </p>
          <p className="mt-3 text-read text-fg-muted">
            Les données de marée, de vent et de houle appartiennent à leurs fournisseurs
            respectifs et restent soumises à leurs propres licences. Les noms de lieux, de
            services et de sociétés cités appartiennent à leurs titulaires.
          </p>
        </section>

        <section aria-labelledby="liens" className="mt-10 max-w-prose">
          <h2 id="liens" className="font-serif text-h2 font-semibold">
            Liens sortants
          </h2>
          <p className="mt-3 text-read text-fg-muted">
            Le site renvoie vers des ressources extérieures, au premier rang desquelles le SHOM et
            Météo-France. Ces sites ne sont pas sous notre contrôle et nous ne répondons pas de
            leur contenu. Aucun de ces liens n’est rémunéré, et le site n’affiche aucune publicité.
          </p>
        </section>

        <section aria-labelledby="donnees-perso" className="mt-10 max-w-prose">
          <h2 id="donnees-perso" className="font-serif text-h2 font-semibold">
            Données personnelles
          </h2>
          <p className="mt-3 text-read text-fg-muted">
            Le traitement des données personnelles, la liste exhaustive de ce qui est collecté et
            l’exercice de vos droits sont détaillés dans la{' '}
            <Link
              href="/confidentialite"
              className="underline decoration-dotted underline-offset-4"
            >
              politique de confidentialité
            </Link>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
