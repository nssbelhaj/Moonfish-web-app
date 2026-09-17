import Image from 'next/image';

import { CatchForm, type SpotChoice } from '@/components/contributions/CatchForm';
import { TableauDeBord } from '@/components/account/panneaux/Tableau';
import type { Catch, Outing, SpotReview } from '@/data/schemas';
import { deleteCatch, deleteReview, setCatchVisibility } from '@/lib/auth/actions';
import { formatMeasures, formatMonth, type CatchLogSummary } from '@/lib/contributions/catch-log';
import { Vide } from '@/components/account/Vide';
import { photoUrl } from '@/lib/photo/url';
import { formatDateTime } from '@/lib/time';

const TIME_ZONE = 'Europe/Paris';

/**
 * Le carnet de prises — la partie du compte dont on se sert le plus.
 *
 * Extrait de `app/compte/page.tsx`, qui faisait huit cent lignes et où cinq
 * panneaux se disputaient le même fichier. Un panneau par fichier : on peut
 * lire celui qu'on modifie sans faire défiler les quatre autres.
 */
export function PanneauCarnet({
  carnet,
  catches,
  reviews,
  outings,
  favoris,
  nameOf,
  spotChoices,
  especesConnues,
}: {
  carnet: CatchLogSummary;
  catches: readonly Catch[];
  reviews: readonly SpotReview[];
  outings: readonly Outing[];
  favoris: number;
  nameOf: (slug: string) => string;
  spotChoices: readonly SpotChoice[];
  especesConnues: readonly string[];
}) {
  const mine = { catches, reviews };

  return (
    <>
      {/* ── Carnet de prises ─────────────────────────────────────────── */}
      <section aria-labelledby="carnet" className="mt-10">
        <h2 id="carnet" className="panneau-titre">
          Carnet de prises
        </h2>
        <p className="panneau-chapo">
          Votre carnet, et rien d’autre : ce que vous déclarez ici apparaît aussi sur la
          page du spot, sous votre nom affiché. Une prise n’entre jamais dans le score —
          un témoignage n’est pas une mesure.
        </p>

        {/*
          Déclarer depuis le carnet, sans passer par la page du spot. C’est le
          geste du soir : on rentre, on note ce qu’on a pris. Ouvert d’emblée
          tant que le carnet est vide, replié ensuite pour que la liste reste
          la première chose qu’on voie.
        */}
        <details className="fiche mt-6" open={carnet.total === 0}>
          <summary className="cursor-pointer text-body font-600 text-fg">
            Déclarer une prise
          </summary>
          <div className="mt-4 max-w-prose">
            <CatchForm
              formId="carnet"
              spotChoices={spotChoices}
              speciesSuggestions={especesConnues}
            />
          </div>
        </details>

        {carnet.total === 0 ? (
          <div className="mt-4">
            <Vide titre="Votre carnet est vide">
              Déclarez une première prise ci-dessus, ou depuis l’onglet « Espèces » d’un spot : le
              carnet se remplit tout seul, déclaration après déclaration.
            </Vide>
          </div>
        ) : (
          <>
            <div className="mt-6">
              <TableauDeBord
                carnet={carnet}
                catches={mine.catches}
                reviews={mine.reviews}
                outings={outings}
                favoris={favoris}
                nameOf={nameOf}
              />
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-3">
              <div>
                <h3 className="fiche-titre">Par espèce</h3>
                <ul className="mt-3 space-y-2">
                  {carnet.bySpecies.slice(0, 8).map((s) => (
                    <li key={s.species} className="flex items-baseline justify-between gap-3 border-b border-surface-2 pb-2 text-body">
                      <span className="text-fg">{s.species}</span>
                      <span className="nums text-fg-muted" data-numeric="">
                        {s.count}
                        {s.bestLengthCm !== null && ` · max ${s.bestLengthCm} cm`}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="fiche-titre">Par spot</h3>
                <ul className="mt-3 space-y-2">
                  {carnet.bySpot.slice(0, 8).map((s) => (
                    <li key={s.spotSlug} className="flex items-baseline justify-between gap-3 border-b border-surface-2 pb-2 text-body">
                      <span className="text-fg">{nameOf(s.spotSlug)}</span>
                      <span className="nums text-fg-muted" data-numeric="">{s.count}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="fiche-titre">Douze derniers mois</h3>
                {/*
                  Des barres proportionnelles au mois le plus fourni. Le
                  chiffre est écrit à côté : la barre est un renfort, pas
                  le porteur de l'information.
                */}
                <ul className="mt-3 space-y-1">
                  {(() => {
                    const max = Math.max(1, ...carnet.byMonth.map((m) => m.count));
                    return carnet.byMonth.map((m) => (
                      <li key={m.month} className="grid grid-cols-[64px_1fr_28px] items-center gap-2 text-meta">
                        <span className="text-fg-muted">{formatMonth(m.month)}</span>
                        <span className="relative h-[8px] rounded-[4px] bg-surface-2">
                          <i
                            className="absolute inset-y-0 left-0 rounded-[4px] bg-accent"
                            style={{ width: `${(m.count / max) * 100}%` }}
                          />
                        </span>
                        <span className="text-right nums text-fg" data-numeric="">{m.count}</span>
                      </li>
                    ));
                  })()}
                </ul>
              </div>
            </div>

            <h3 className="fiche-titre mt-8">
              Toutes les prises{' '}
              <span className="nums font-400 text-fg-muted">{mine.catches.length}</span>
            </h3>
            <ul className="mt-3 grid gap-3 md:grid-cols-2">
              {mine.catches.map((entry) => {
                const vignette = photoUrl(entry.photoPath);

                return (
                <li key={entry.id} className="fiche">
                  {/*
                    Deux lignes, pas une.

                    L'espèce, les mesures et le spot tenaient sur une seule
                    ligne en `justify-between`, séparés par des points
                    médians : « Maquereau · 52 cm · 1,80 kg » d'un côté, le
                    nom du spot de l'autre. Dès que l'un des deux s'allongeait,
                    la ligne se cassait et le nom du spot partait seul à
                    droite, sous le reste. Les mesures ont maintenant leur
                    ligne, cadrée à gauche et en chiffres tabulaires : deux
                    prises l'une sous l'autre alignent leurs unités.
                  */}
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate text-body font-600 text-fg">{entry.species}</span>
                    <span className="shrink-0 text-meta text-fg-muted">{nameOf(entry.spotSlug)}</span>
                  </div>

                  <p className="mt-1 text-body text-fg-muted">
                    <span className="nums" data-numeric="">
                      {formatMeasures(entry.lengthCm, entry.weightG) ?? 'sans mesure'}
                    </span>
                    {entry.released && <span> · relâché</span>}
                  </p>

                  {vignette !== null && (
                    <Image
                      src={vignette}
                      alt={`Votre prise : ${entry.species} à ${nameOf(entry.spotSlug)}`}
                      width={640}
                      height={480}
                      sizes="(max-width: 768px) 100vw, 320px"
                      className="mt-3 h-auto w-full rounded-inner"
                    />
                  )}
                  {entry.note && <p className="mt-2 max-w-prose text-body text-fg">{entry.note}</p>}

                  <div className="card-source mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="nums" data-numeric="">
                      {formatDateTime(new Date(entry.caughtAt), TIME_ZONE)}
                    </span>

                    {/*
                      La visibilité VOULUE part en champ caché, jamais une
                      bascule qui relirait l'état courant : deux onglets sur le
                      même carnet s'inverseraient l'un l'autre.
                    */}
                    <form action={setCatchVisibility}>
                      <input type="hidden" name="catch_id" value={entry.id} />
                      <input type="hidden" name="spot_slug" value={entry.spotSlug} />
                      <input
                        type="hidden"
                        name="visibility"
                        value={entry.visibility === 'publique' ? 'privee' : 'publique'}
                      />
                      <button type="submit" className="etiquette-visibilite" data-publique={entry.visibility === 'publique' ? '' : undefined}>
                        {entry.visibility === 'publique' ? 'Publiée' : 'Privée'}
                        <span className="sr-only">
                          {entry.visibility === 'publique'
                            ? ' — la retirer de la page du spot'
                            : ' — la publier sur la page du spot'}
                        </span>
                      </button>
                    </form>

                    <form action={deleteCatch}>
                      <input type="hidden" name="catch_id" value={entry.id} />
                      <input type="hidden" name="spot_slug" value={entry.spotSlug} />
                      <button type="submit" className="underline decoration-dotted underline-offset-4 hover:text-fg">
                        Supprimer
                      </button>
                    </form>
                  </div>
                </li>
                );
              })}
            </ul>
          </>
        )}
      </section>

      {mine.reviews.length > 0 && (
        <section aria-labelledby="avis" className="mt-10">
          <h2 id="avis" className="panneau-titre">
            Vos avis{' '}
            <span className="nums font-400 text-fg-muted">{mine.reviews.length}</span>
          </h2>
          <ul className="mt-4 grid gap-3 md:grid-cols-2">
            {mine.reviews.map((review) => (
              <li key={review.id} className="fiche">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <span className="text-body font-600 text-fg">{nameOf(review.spotSlug)}</span>
                  <span className="nums text-body text-fg-muted">{review.rating}/5</span>
                </div>
                {review.comment && <p className="mt-2 max-w-prose text-body text-fg">{review.comment}</p>}
                <div className="card-source mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="nums">{formatDateTime(new Date(review.createdAt), TIME_ZONE)}</span>
                  <form action={deleteReview}>
                    <input type="hidden" name="review_id" value={review.id} />
                    <input type="hidden" name="spot_slug" value={review.spotSlug} />
                    <button type="submit" className="underline decoration-dotted underline-offset-4 hover:text-fg">
                      Supprimer
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
