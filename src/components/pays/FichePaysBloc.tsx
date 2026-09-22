import Link from 'next/link';

import type { FichePays } from '@/data/pays';
import { formatDateLong } from '@/lib/time';

/**
 * « Ce qui change ici » : la marée, la saison, la règle, le danger.
 *
 * Quatre blocs, parce que ce sont les quatre choses qu'un pêcheur qui change
 * de pays doit réapprendre — et les quatre qu'aucun calcul ne donne. Tout ce
 * qui se calcule (spots, espèces, scores) est ailleurs sur la page.
 */
export function FichePaysBloc({
  fiche,
  especes,
  marees,
}: {
  fiche: FichePays;
  especes: readonly { nom: string; spots: number }[];
  marees: { reelles: number; simulees: number };
}) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <section className="surface p-5">
        <h3 className="card-title">La marée</h3>
        <dl className="mt-3 space-y-3">
          {fiche.facades.map((facade) => (
            <div key={facade.sea}>
              <dt className="text-body font-600 text-fg">Sur {facade.nom}</dt>
              <dd className="mt-1 max-w-prose text-body text-fg-muted">{facade.maree}</dd>
            </div>
          ))}
        </dl>
        <p className="card-source mt-4 nums" data-numeric="">
          {marees.reelles === 0
            ? 'Marées simulées sur tous les spots de ce pays : le réglage TIDE_REAL_SPOTS ne leur a pas encore ouvert le fournisseur réel.'
            : marees.simulees === 0
              ? `Marées réelles sur les ${marees.reelles} spots de ce pays.`
              : `Marées réelles sur ${marees.reelles} spot${marees.reelles > 1 ? 's' : ''} de ce pays, simulées sur ${marees.simulees}.`}
        </p>
      </section>

      <section className="surface p-5">
        <h3 className="card-title">La saison</h3>
        <p className="mt-3 max-w-prose text-body text-fg-muted">{fiche.saisons}</p>
        <h4 className="mt-4 text-body font-600 text-fg">Les espèces les plus citées par nos spots</h4>
        <ul className="mt-2 flex flex-wrap gap-2">
          {especes.map((espece) => (
            <li
              key={espece.nom}
              className="pill inline-flex items-center gap-1.5 px-3 py-1 text-meta nums"
              data-numeric=""
            >
              <span className="text-fg">{espece.nom}</span>
              <span className="text-fg-muted">{espece.spots}</span>
            </li>
          ))}
        </ul>
        <p className="card-source mt-4">
          Comptage sur le catalogue : le nombre de spots qui nomment l’espèce. Ce n’est pas une
          promesse de prise.
        </p>
      </section>

      <section className="surface p-5">
        <h3 className="card-title">La règle</h3>
        <p className="mt-3 max-w-prose text-body text-fg-muted">{fiche.reglementation.resume}</p>
        <p className="card-source mt-4">
          Source :{' '}
          <Link
            href={fiche.reglementation.url}
            className="text-fg underline decoration-dotted underline-offset-4"
            rel="noopener"
          >
            {fiche.reglementation.autorite}
          </Link>
          . Paragraphe relu le{' '}
          <span className="nums">{formatDateLong(new Date(fiche.reglementation.relu), 'Europe/Paris')}</span>
          .
        </p>
      </section>

      <section className="surface p-5">
        <h3 className="card-title">Le danger propre au lieu</h3>
        <p className="mt-3 max-w-prose text-body text-fg-muted">{fiche.securite}</p>
        {fiche.heure && (
          <>
            <h4 className="mt-4 text-body font-600 text-fg">L’heure</h4>
            <p className="mt-1 max-w-prose text-body text-fg-muted">{fiche.heure}</p>
          </>
        )}
        <p className="card-source mt-4">
          Au-delà de 2,5 m de houle ou de 50 km/h de vent, le bandeau de danger s’affiche sur le
          spot, quel que soit le score.
        </p>
      </section>
    </div>
  );
}
