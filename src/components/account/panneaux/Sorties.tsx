import Link from 'next/link';

import type { Favorite, Outing } from '@/data/schemas';
import { ActionForm } from '@/components/forms/ActionForm';
import { deleteOuting, setFavoriteAlert } from '@/lib/auth/actions';
import type { ForecastSlot, SpotSummary } from '@/lib/forecast';
import { Vide } from '@/components/account/Vide';
import { spotPath } from '@/lib/routes';
import { formatDateTime } from '@/lib/time';
import type { Score } from '@/components/account/score';

const TIME_ZONE = 'Europe/Paris';

/** Sorties programmées et spots favoris : les deux listes tournées vers l'avenir. */
export function PanneauSorties({
  upcoming,
  outingSlots,
  favoriteSummaries,
  favorites,
  alertesPossibles,
  nameOf,
  pathOf,
  scoreOf,
}: {
  upcoming: readonly Outing[];
  outingSlots: Map<string, ForecastSlot | null>;
  favoriteSummaries: readonly SpotSummary[];
  /** Les favoris eux-mêmes, pour le seuil d'alerte de chacun. */
  favorites: readonly Favorite[];
  /** `false` sans courriel configuré : le réglage n'est alors pas proposé. */
  alertesPossibles: boolean;
  nameOf: (slug: string) => string;
  pathOf: (slug: string) => string | null;
  scoreOf: (slot: ForecastSlot | null) => Score;
}) {
  return (
    <>
      {/* ── Sorties programmées ─────────────────────────────────────── */}
      <section aria-labelledby="sorties">
        <h2 id="sorties" className="panneau-titre">
          Sorties programmées
        </h2>
        {upcoming.length === 0 ? (
          <div className="mt-4">
            <Vide
              titre="Aucune sortie programmée"
              action={
                <Link
                  href="/spots"
                  className="inline-flex min-h-tap items-center rounded-ctl border border-edge-strong px-5 font-600 text-fg hover:bg-surface-2"
                >
                  Choisir un spot
                </Link>
              }
            >
              Programmez-en une depuis l’onglet « Espèces » d’un spot : vous recevrez les
              conditions prévues la veille, par courriel, si vous le demandez.
            </Vide>
          </div>
        ) : (
          <ul className="mt-4 grid gap-3 md:grid-cols-2">
            {upcoming.map((outing) => {
              const slot = outingSlots.get(outing.id) ?? null;
              const score = scoreOf(slot);
              const href = pathOf(outing.spotSlug);
              const belowThreshold =
                outing.minScore !== null &&
                slot?.score.value !== null &&
                slot?.score.value !== undefined &&
                slot.score.value < outing.minScore;

              return (
                <li key={outing.id} className="fiche">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      {href ? (
                        <Link href={`${href}/prevision`} className="text-body font-600 text-fg underline decoration-dotted underline-offset-4">
                          {nameOf(outing.spotSlug)}
                        </Link>
                      ) : (
                        <span className="text-body font-600 text-fg">{nameOf(outing.spotSlug)}</span>
                      )}
                      <p className="mt-1 text-body nums text-fg-muted">
                        {formatDateTime(new Date(outing.plannedAt), TIME_ZONE)}
                      </p>
                      {outing.note && <p className="mt-2 max-w-prose text-body text-fg">{outing.note}</p>}
                    </div>
                    <div className="text-right">
                      <span className="block text-[22px] font-bold nums" style={{ color: score.color }} data-numeric="">
                        {score.text}
                      </span>
                      <span className="block text-[11px]" style={{ color: score.color }}>
                        {slot ? score.label : 'au-delà de 7 jours'}
                      </span>
                    </div>
                  </div>

                  {slot?.score.safety.level === 'danger' && (
                    <p className="mt-3 text-body font-600 text-danger">
                      Danger prévu à cette heure-là — ne sortez pas.
                    </p>
                  )}
                  {!slot?.score.safety || slot.score.safety.level !== 'danger' ? (
                    belowThreshold ? (
                      <p className="mt-3 text-body text-fg-muted">
                        Sous votre seuil de <span className="nums">{outing.minScore}</span>.
                      </p>
                    ) : null
                  ) : null}

                  <div className="card-source mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span>
                      {outing.alert
                        ? outing.notifiedAt
                          ? `Courriel envoyé le ${formatDateTime(new Date(outing.notifiedAt), TIME_ZONE)}`
                          : 'Courriel la veille'
                        : 'Sans courriel'}
                    </span>
                    {outing.minScore !== null && (
                      <span className="nums">seuil {outing.minScore}</span>
                    )}
                    <form action={deleteOuting}>
                      <input type="hidden" name="outing_id" value={outing.id} />
                      <button type="submit" className="underline decoration-dotted underline-offset-4 hover:text-fg">
                        Supprimer
                      </button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ── Favoris ─────────────────────────────────────────────────── */}
      <section aria-labelledby="favoris" className="mt-10">
        <h2 id="favoris" className="panneau-titre">
          Spots favoris
        </h2>
        {favoriteSummaries.length === 0 ? (
          <div className="mt-4">
            <Vide
              titre="Aucun spot favori"
              action={
                <Link
                  href="/carte"
                  className="inline-flex min-h-tap items-center rounded-ctl border border-edge-strong px-5 font-600 text-fg hover:bg-surface-2"
                >
                  Parcourir la carte
                </Link>
              }
            >
              Le bouton « Ajouter aux favoris » est en haut de chaque page de spot ; vous
              retrouverez ici leur score du moment, en un coup d’œil.
            </Vide>
          </div>
        ) : (
          <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {favoriteSummaries.map(({ spot, current, nextGood }) => {
              const score = scoreOf(current);
              const seuil = favorites.find((f) => f.spotSlug === spot.slug)?.alertMinScore ?? null;
              return (
                <li key={spot.slug} className="fiche !p-3 flex flex-col gap-3">
                  <Link
                    href={spotPath(spot)}
                    className="flex min-h-tap items-center justify-between gap-3 tappable"
                  >
                    <span>
                      <span className="block text-body font-600 text-fg">{spot.name}</span>
                      <span className="block text-meta text-fg-muted">
                        {nextGood
                          ? `prochaine bonne fenêtre ${formatDateTime(new Date(nextGood.start), spot.timezone)}`
                          : spot.regionName}
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="block text-[19px] font-bold nums" style={{ color: score.color }} data-numeric="">
                        {score.text}
                      </span>
                      <span className="block text-[11px]" style={{ color: score.color }}>
                        {score.label}
                      </span>
                    </span>
                  </Link>

                  {/*
                    « Prévenez-moi dès 8 » : le seuil vit sur le favori, et
                    la tâche quotidienne écrit quand le meilleur créneau des
                    36 prochaines heures l'atteint — une fois par créneau.
                    Sans courriel configuré, rien n'est proposé plutôt qu'un
                    réglage qui ne servirait à rien.
                  */}
                  {alertesPossibles && (
                    <ActionForm
                      action={setFavoriteAlert}
                      submitLabel="Régler"
                      pendingLabel="…"
                      variant="secondary"
                      className="flex flex-wrap items-end gap-2"
                    >
                      <input type="hidden" name="spot_slug" value={spot.slug} />
                      <label className="flex flex-col gap-1 text-meta text-fg-muted">
                        Me prévenir dès
                        <select
                          name="seuil"
                          defaultValue={seuil === null ? '' : String(seuil)}
                          className="min-h-[44px] rounded-ctl border border-edge bg-card px-2 text-body text-fg"
                        >
                          <option value="">jamais</option>
                          {[6, 7, 8, 9].map((n) => (
                            <option key={n} value={n}>
                              {n} / 10
                            </option>
                          ))}
                        </select>
                      </label>
                    </ActionForm>
                  )}
                  {seuil !== null && (
                    <p className="text-src text-fg-muted">
                      Alerte active : courriel dès que le meilleur créneau des 36 h à venir atteint{' '}
                      {seuil}.
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
