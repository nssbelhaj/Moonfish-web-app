import Image from 'next/image';
import Link from 'next/link';

import type { Catch, SpotReview } from '@/data/schemas';
import { photoUrl } from '@/lib/photo/url';
import { formatDateLong } from '@/lib/time';

/**
 * Ce que les pêcheurs ont déclaré ici, récemment.
 *
 * ─── Rien n'est inventé, même quand c'est vide ────────────────────────────
 *
 * Aucune contribution de démonstration, aucun avis d'exemple, aucun nom
 * plausible. Les marées peuvent être simulées — une marée inventée reste une
 * illustration honnête d'un mécanisme — mais un témoignage fabriqué est un
 * faux témoignage, sur une page qui annonce précisément « ce que les pêcheurs
 * déclarent ». Tant que personne n'a rien publié, la section le dit et
 * explique comment publier.
 *
 * ─── Les prises affichées sont publiques, et rien d'autre ─────────────────
 *
 * Le filtre est appliqué dans la requête SQL (`visibility = 'publique'`) :
 * une prise privée ne quitte pas la base. Ce composant n'a donc AUCUN filtre
 * à appliquer — et c'est voulu : un filtre au rendu est un filtre qu'on
 * oublie en recopiant le composant ailleurs.
 */

const TIME_ZONE = 'Europe/Paris';

export interface EntreeContribution {
  spotNom: string;
  spotHref: string;
}

function Etoiles({ note }: { note: number }) {
  return (
    <span className="nums text-meta text-fg" data-numeric="">
      <span aria-hidden="true">{'★'.repeat(note) + '☆'.repeat(5 - note)}</span>
      <span className="sr-only">{note} sur 5</span>
    </span>
  );
}

export function DernieresContributions({
  prises,
  avis,
}: {
  prises: readonly (Catch & EntreeContribution)[];
  avis: readonly (SpotReview & EntreeContribution)[];
}) {
  if (prises.length === 0 && avis.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-edge-strong p-6">
        <p className="max-w-prose text-body text-fg">
          Personne n’a encore publié ici. Et rien ne sera inventé pour remplir cette section : un
          avis d’exemple signé d’un pêcheur qui n’existe pas vaudrait moins que rien.
        </p>
        <p className="mt-3 max-w-prose text-body text-fg-muted">
          Une prise déclarée, c’est une espèce, une heure et un coefficient — exactement ce qui
          manque pour dire ce qui se prend vraiment, et quand. Chaque prise reste privée par
          défaut : la publier est une case à cocher, jamais une conséquence.
        </p>
        <p className="mt-4">
          <Link
            href="/compte"
            className="inline-flex min-h-[44px] items-center text-body text-fg underline decoration-dotted underline-offset-4"
          >
            Ouvrir un carnet de prises
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div>
        <h3 className="text-h3 font-semibold font-600">Dernières prises publiées</h3>

        {prises.length === 0 ? (
          <p className="mt-3 max-w-prose text-body text-fg-muted">
            Aucune prise publique pour l’instant. Les carnets existent, ils sont simplement restés
            privés — ce qui est leur réglage par défaut.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {prises.map((prise) => {
              const vignette = photoUrl(prise.photoPath);
              const mesures = [
                prise.lengthCm === null ? null : `${prise.lengthCm} cm`,
                prise.weightG === null
                  ? null
                  : prise.weightG >= 1000
                    ? `${(prise.weightG / 1000).toFixed(1).replace('.', ',')} kg`
                    : `${prise.weightG} g`,
              ].filter((m): m is string => m !== null);

              return (
                <li
                  key={prise.id}
                  className="flex gap-3 rounded-card border border-edge bg-card p-3"
                >
                  {vignette !== null && (
                    <Image
                      src={vignette}
                      alt=""
                      width={96}
                      height={72}
                      sizes="96px"
                      className="h-[72px] w-[96px] shrink-0 rounded-inner object-cover"
                    />
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <span className="text-body font-600 text-fg">{prise.species}</span>
                      {mesures.length > 0 && (
                        <span className="nums text-meta text-fg-muted" data-numeric="">
                          {mesures.join(' · ')}
                        </span>
                      )}
                    </div>

                    {/*
                      La note est ce qui distingue une prise déclarée d'une
                      ligne de statistique : « chasse dans le ressac une heure
                      avant la pleine mer » est l'information que personne
                      d'autre ne publie. L'omettre laissait une carte exacte
                      et sans intérêt.
                    */}
                    {prise.note !== null && (
                      <p className="mt-1 max-w-prose text-body text-fg">{prise.note}</p>
                    )}

                    <p className="mt-1 text-meta nums text-fg-muted" data-numeric="">
                      <Link
                        href={prise.spotHref}
                        className="underline decoration-dotted underline-offset-4"
                      >
                        {prise.spotNom}
                      </Link>{' '}
                      · {formatDateLong(new Date(prise.caughtAt), TIME_ZONE)}
                      {prise.released ? ' · remis à l’eau' : ''}
                    </p>

                    <p className="mt-1 text-src text-fg-faint">{prise.authorName}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div>
        <h3 className="text-h3 font-semibold font-600">Derniers avis sur les spots</h3>

        {avis.length === 0 ? (
          <p className="mt-3 max-w-prose text-body text-fg-muted">
            Aucun avis pour l’instant. Un avis note le LIEU — son accès, son stationnement, sa
            sécurité — pas les conditions du jour, dont le score se charge.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {avis.map((entree) => (
              <li key={entree.id} className="rounded-card border border-edge bg-card p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <Etoiles note={entree.rating} />
                  <span className="text-meta nums text-fg-muted" data-numeric="">
                    <Link
                      href={entree.spotHref}
                      className="underline decoration-dotted underline-offset-4"
                    >
                      {entree.spotNom}
                    </Link>
                  </span>
                </div>

                {entree.comment !== null && (
                  <p className="mt-2 max-w-prose text-body text-fg">{entree.comment}</p>
                )}

                <p className="mt-2 text-src text-fg-faint nums" data-numeric="">
                  {entree.authorName} · {formatDateLong(new Date(entree.createdAt), TIME_ZONE)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
