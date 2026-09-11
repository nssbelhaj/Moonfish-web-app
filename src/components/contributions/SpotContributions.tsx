import Image from 'next/image';
import Link from 'next/link';

import { ContributePanel } from '@/components/contributions/ContributePanel';
import { formatMeasures } from '@/lib/contributions/catch-log';
import { photoUrl } from '@/lib/photo/url';
import type { SpotContributions as Contributions } from '@/lib/providers';
import { formatDateTime } from '@/lib/time';

const TIME_ZONE = 'Europe/Paris';

function Stars({ rating }: { rating: number }) {
  // Une note se lit en clair pour tout le monde ; les cercles pleins sont un
  // renfort visuel, pas le porteur de l'information (D-redondance).
  return (
    <span className="inline-flex items-center gap-2">
      <span className="nums text-body font-600 text-fg">{rating}/5</span>
      <span aria-hidden="true" className="text-body text-fg-muted">
        {'●'.repeat(rating)}
        {'○'.repeat(5 - rating)}
      </span>
    </span>
  );
}

/**
 * Avis et prises déclarées d'un spot.
 *
 * Trois états, et le composant ne triche sur aucun :
 *
 *   — comptes non configurés : on annonce que ce n'est pas ouvert. Aucun faux
 *     avis, aucune donnée d'exemple. Une marée simulée illustre le
 *     fonctionnement du site ; un témoignage simulé serait un faux témoignage ;
 *   — connecté sans profil : on renvoie vers le choix du nom affiché ;
 *   — vide : on écrit qu'il n'y a rien encore, plutôt que de masquer la section.
 */
export function SpotContributionsSection({
  contributions,
  available,
  spotSlug,
  spotPath,
  spotName,
  speciesSuggestions,
}: {
  contributions: Contributions;
  available: boolean;
  spotSlug: string;
  spotPath: string;
  spotName: string;
  speciesSuggestions: readonly string[];
}) {
  /*
    Les prises qui portent une photo, les plus récentes d'abord. Calculé ici et
    non dans le dépôt : c'est une VUE, pas une donnée — la galerie ne vaut que
    pour l'affichage, et la liste des prises reste la source.
  */
  const galerie = contributions.catches
    .flatMap((entry) => {
      const url = photoUrl(entry.photoPath);
      return url === null ? [] : [{ entry, url }];
    })
    .sort((a, b) => b.entry.caughtAt.localeCompare(a.entry.caughtAt))
    .slice(0, 12);

  return (
    <section aria-labelledby="contributions" className="mt-12">
      <h2 id="contributions" className="font-serif text-h2 font-semibold">
        Ce que les pêcheurs déclarent ici
      </h2>

      <p className="mt-2 max-w-prose text-read text-fg-muted">
        Avis et prises rapportés par des personnes titulaires d’un compte. Ce sont des témoignages,
        pas des mesures : nous ne les vérifions pas, et ils n’entrent pas dans le score.
      </p>

      {!available ? (
        <p className="demo-frame mt-4 max-w-prose p-4 text-read text-fg-muted">
          <strong className="font-600 text-fg">Pas encore ouvert.</strong> Ce déploiement n’a pas de
          base de données : personne ne peut publier ici, et nous n’affichons pas d’exemples
          fabriqués pour meubler. Une marée simulée illustre un mécanisme ; un faux avis serait un
          faux témoignage.
        </p>
      ) : (
        <>
          {galerie.length > 0 && (
            <div className="mt-6">
              <h3 className="card-title">
                Photos partagées ici{' '}
                <span className="nums font-400 text-fg-muted">{galerie.length}</span>
              </h3>
              <p className="mt-2 max-w-prose text-body text-fg-muted">
                Publiées par des pêcheurs avec leur déclaration de prise. Les métadonnées, position
                GPS comprise, sont retirées sur leur appareil avant tout envoi : une photo ne
                trahit pas le poste de celui qui l’a prise.
              </p>

              <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {galerie.map(({ entry, url }) => (
                  <li key={entry.id} className="surface overflow-hidden">
                    <Image
                      src={url}
                      alt={`Prise déclarée : ${entry.species} à ${spotName}`}
                      width={640}
                      height={480}
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 240px"
                      className="h-[140px] w-full object-cover"
                    />
                    <div className="p-3">
                      <p className="text-body font-600 text-fg">{entry.species}</p>
                      <p className="card-source mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span>{entry.authorName}</span>
                        <span className="nums">
                          {formatDateTime(new Date(entry.caughtAt), TIME_ZONE)}
                        </span>
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            {/* ── Avis ───────────────────────────────────────────────── */}
            <div>
              <h3 className="card-title">
                Avis sur le spot
                {contributions.averageRating !== null && (
                  <span className="ml-2 text-body font-400 text-fg-muted">
                    <span className="nums">
                      {contributions.averageRating.toFixed(1).replace('.', ',')}
                    </span>
                    /5 sur <span className="nums">{contributions.reviewCount}</span>
                  </span>
                )}
              </h3>

              {contributions.reviews.length === 0 ? (
                <p className="mt-3 max-w-prose text-body text-fg-muted">
                  Aucun avis pour l’instant. Le premier sera le vôtre.
                </p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {contributions.reviews.map((review) => (
                    <li key={review.id} className="surface p-4">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                        <span className="text-body font-600 text-fg">{review.authorName}</span>
                        <Stars rating={review.rating} />
                      </div>
                      {review.comment && (
                        <p className="mt-2 max-w-prose text-body text-fg">{review.comment}</p>
                      )}
                      <p className="card-source mt-3 nums">
                        {formatDateTime(new Date(review.createdAt), TIME_ZONE)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* ── Prises ─────────────────────────────────────────────── */}
            <div>
              <h3 className="card-title">
                Prises déclarées
                {contributions.catches.length > 0 && (
                  <span className="ml-2 text-body font-400 text-fg-muted nums">
                    {contributions.catches.length}
                  </span>
                )}
              </h3>

              {contributions.catches.length === 0 ? (
                <p className="mt-3 max-w-prose text-body text-fg-muted">
                  Aucune prise déclarée. C’est précisément ce qui manque pour dire ce qui se prend
                  vraiment à {spotName}, et à quel moment.
                </p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {contributions.catches.map((entry) => {
                    const size = formatMeasures(entry.lengthCm, entry.weightG);

                    return (
                      <li key={entry.id} className="surface p-4">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                          <span className="text-body font-600 text-fg">{entry.species}</span>
                          {size && <span className="nums text-body text-fg-muted">{size}</span>}
                        </div>

                        {entry.note && (
                          <p className="mt-2 max-w-prose text-body text-fg">{entry.note}</p>
                        )}

                        <p className="card-source mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span>{entry.authorName}</span>
                          <span className="nums">
                            {formatDateTime(new Date(entry.caughtAt), TIME_ZONE)}
                          </span>
                          {entry.released && <span>remis à l’eau</span>}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          {/* ── Contribuer ───────────────────────────────────────────── */}
          <div className="mt-8">
            <ContributePanel
              spotSlug={spotSlug}
              spotPath={spotPath}
              speciesSuggestions={speciesSuggestions}
            />
          </div>

          <p className="mt-4 max-w-prose text-meta text-fg-muted">
            Vos propres contributions se modifient et se suppriment depuis{' '}
            <Link href="/compte" className="underline decoration-dotted underline-offset-4">
              votre compte
            </Link>
            .
          </p>
        </>
      )}
    </section>
  );
}
