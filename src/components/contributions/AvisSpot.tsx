import Link from 'next/link';

import { ContributePanel } from '@/components/contributions/ContributePanel';
import { NoteDetaillee } from '@/components/contributions/NoteSpot';
import type { SpotContributions, SpotRating } from '@/lib/providers';
import { formatDateTime } from '@/lib/time';

const TIME_ZONE = 'Europe/Paris';

/**
 * Les avis d'un spot, sur sa page principale.
 *
 * ─── Pourquoi ils ont déménagé ────────────────────────────────────────────
 *
 * Ils vivaient sur l'onglet « Espèces », avec les prises déclarées. Le
 * rangement était logique — tout ce que les pêcheurs écrivent au même
 * endroit — et personne ne les trouvait : on ne clique pas « Espèces » pour
 * lire ce que les gens disent d'un lieu. Les avis parlent de l'ACCÈS, du
 * stationnement, de la sécurité : ils concernent quiconque envisage d'y
 * aller, pas seulement qui cherche une espèce.
 *
 * ─── Ce qu'une note ne dit pas, et qui doit être écrit ────────────────────
 *
 * Une note porte sur le LIEU, pas sur les conditions du jour. Une pointe à
 * 4,5 étoiles reste impraticable par houle d'ouest — c'est le score qui le
 * dit, et lui seul. Confondre les deux est le seul vrai risque de cette
 * fonctionnalité, d'où la phrase sous le bloc, qui n'est pas une précaution
 * de style.
 */
export function AvisSpot({
  contributions,
  note,
  available,
  spotSlug,
  spotPath,
  spotName,
  speciesSuggestions,
}: {
  contributions: SpotContributions;
  note: SpotRating;
  available: boolean;
  spotSlug: string;
  spotPath: string;
  spotName: string;
  /** Le panneau propose aussi « déclarer une prise » : il lui faut le catalogue. */
  speciesSuggestions: readonly string[];
}) {
  /*
    Deux identifiants DISTINCTS, et ce n'est pas un détail : « avis » sur la
    section est la cible de l'ancre, et le titre en portait un second,
    identique. Un document à identifiant dupliqué casse `aria-labelledby` —
    un lecteur d'écran résout le premier élément rencontré, donc la section
    entière au lieu de son titre — et rend le saut vers « #avis » dépendant
    du navigateur. Rien ne le signale, ni en développement ni au build.
  */
  return (
    <section aria-labelledby="avis-titre" id="avis" className="mt-12 scroll-mt-6">
      <h2 id="avis-titre" className="font-serif text-h2 font-semibold">
        Avis sur {spotName}
      </h2>
      <p className="mt-2 max-w-prose text-read text-fg-muted">
        Ce que des pêcheurs disent du lieu : accès, stationnement, sécurité, ce qu’on y voit. Une
        note porte sur le <strong className="font-600 text-fg">spot</strong>, jamais sur les
        conditions du jour — un beau spot reste impraticable par grosse houle, et c’est le score
        qui le dit.
      </p>

      {!available ? (
        <p className="demo-frame mt-4 max-w-prose p-4 text-read text-fg-muted">
          <strong className="font-600 text-fg">Pas encore ouvert.</strong> Ce déploiement n’a pas de
          base de données : personne ne peut publier ici, et nous n’affichons pas d’avis fabriqués
          pour meubler. Une marée simulée illustre un mécanisme ; un faux témoignage serait un faux
          témoignage.
        </p>
      ) : note.average === null ? (
        <div className="vide mt-6">
          <p className="vide-titre">Aucun avis pour l’instant</p>
          <p className="vide-texte">
            Le premier sera le vôtre. Ce qui aide le plus : comment on accède, où l’on se gare, et
            ce qui demande de la prudence.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-6">
            <NoteDetaillee note={note} />
          </div>

          <ul className="mt-6 grid gap-3 lg:grid-cols-2">
            {contributions.reviews.map((review) => (
              <li key={review.id} className="fiche">
                <div className="flex items-start gap-3">
                  <span
                    aria-hidden="true"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-pill bg-surface-2 font-serif text-body text-fg"
                  >
                    {review.authorName.trim().slice(0, 1).toUpperCase() || '•'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                      <span className="text-body font-600 text-fg">{review.authorName}</span>
                      <span className="inline-flex items-center gap-2">
                        <span aria-hidden="true" className="note-etoiles text-[15px]">
                          {'★'.repeat(review.rating)}
                          <span className="text-edge">{'★'.repeat(5 - review.rating)}</span>
                        </span>
                        <span className="sr-only">{review.rating} sur 5</span>
                      </span>
                    </div>
                    <p className="card-source mt-0.5 nums">
                      {formatDateTime(new Date(review.createdAt), TIME_ZONE)}
                    </p>
                    {review.comment && (
                      <p className="mt-2 max-w-prose text-body text-fg">{review.comment}</p>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {available && (
        <>
          <div className="mt-8">
            <ContributePanel
              spotSlug={spotSlug}
              spotPath={spotPath}
              speciesSuggestions={speciesSuggestions}
            />
          </div>

          <p className="mt-4 max-w-prose text-meta text-fg-muted">
            Les prises déclarées et les photos partagées sont sur{' '}
            <Link
              href={`${spotPath}/especes`}
              className="underline decoration-dotted underline-offset-4"
            >
              l’onglet Espèces
            </Link>
            . Vos propres contributions se modifient depuis{' '}
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
