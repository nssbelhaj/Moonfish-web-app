import type { Metadata } from 'next';
import Link from 'next/link';

import { DeleteAccountForm } from '@/components/account/DeleteAccountForm';
import { ProfileForm } from '@/components/account/ProfileForm';
import { SignInForm } from '@/components/account/SignInForm';
import { Button } from '@/components/ui/Button';
import { formatMonth, summarizeCatches } from '@/lib/contributions/catch-log';
import { getSpotForecast, getSpotSummary, type ForecastSlot } from '@/lib/forecast';
import { contributions, spots as spotRepository } from '@/lib/providers';
import { deleteCatch, deleteOuting, deleteReview, signOut } from '@/lib/auth/actions';
import { absoluteUrl, spotPath } from '@/lib/routes';
import { currentUser } from '@/lib/auth/session';
import { formatScore, tierForOrNull } from '@/lib/score-display';
import { formatDateTime } from '@/lib/time';

/** Une page de compte ne se met pas en cache : elle dépend de la session. */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Votre compte',
  description:
    'Se connecter à Moonfish : carnet de prises, spots favoris, sorties programmées, export et effacement de ses données.',
  alternates: { canonical: absoluteUrl('/compte') },
  // Une page de session n'a rien à faire dans un index : elle n'a pas de
  // contenu stable, et son URL indexée n'amènerait qu'une page vide.
  robots: { index: false, follow: true },
};

const ERRORS: Record<string, string> = {
  'lien-invalide': 'Ce lien de connexion est incomplet. Demandez-en un nouveau.',
  'lien-expire':
    'Ce lien n’est plus valable : il a expiré, il a déjà servi, ou il a été ouvert dans un autre navigateur. Demandez-en un nouveau.',
  'comptes-fermes': 'Les comptes ne sont pas ouverts sur ce déploiement.',
};

const TIME_ZONE = 'Europe/Paris';

/** Score et couleur d'un créneau, ou l'absence de données, en un seul objet. */
function scoreOf(slot: ForecastSlot | null): { text: string; color: string; label: string } {
  const value = slot?.score.value ?? null;
  const danger = slot?.score.safety.level === 'danger';
  const tier = tierForOrNull(value);
  return {
    text: formatScore(value),
    color: danger ? 'var(--danger)' : (tier?.colorVar ?? 'var(--edge-strong)'),
    label: danger ? 'Danger' : (tier?.label ?? 'Indispo.'),
  };
}

function slotAt(days: { slots: ForecastSlot[] }[], instantMs: number): ForecastSlot | null {
  for (const day of days) {
    for (const slot of day.slots) {
      if (new Date(slot.start).getTime() <= instantMs && new Date(slot.end).getTime() > instantMs) {
        return slot;
      }
    }
  }
  return null;
}

export default async function ComptePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const errorKey = typeof params.erreur === 'string' ? params.erreur : null;
  const justDeleted = params.efface === '1';

  const user = await currentUser();
  const profile = user ? await contributions.getProfile(user.id) : null;
  const mine = user ? await contributions.listForUser(user.id) : { reviews: [], catches: [] };
  const favorites = user ? await contributions.listFavorites(user.id) : [];
  const outings = user ? await contributions.listOutings(user.id) : [];

  // Les noms de spots, pour ne plus afficher des slugs à la personne.
  const allSpots = await spotRepository.list();
  const spotBySlug = new Map(allSpots.map((spot) => [spot.slug, spot]));
  const nameOf = (slug: string): string => spotBySlug.get(slug)?.name ?? slug;
  const pathOf = (slug: string): string | null => {
    const spot = spotBySlug.get(slug);
    return spot ? spotPath(spot) : null;
  };

  /*
    Les favoris portent leur score du moment, et les sorties à venir le score
    prévu à l'heure dite. Les deux passent par le cache de prévision partagé
    avec les pages de spot : aucun appel supplémentaire aux fournisseurs.
  */
  const favoriteSummaries = await Promise.all(
    favorites.flatMap((favorite) => {
      const spot = spotBySlug.get(favorite.spotSlug);
      return spot ? [getSpotSummary(spot)] : [];
    }),
  );

  const nowMs = Date.now();
  const upcoming = outings.filter((outing) => new Date(outing.plannedAt).getTime() >= nowMs - 3_600_000);
  const outingSlots = new Map<string, ForecastSlot | null>();
  for (const outing of upcoming) {
    const spot = spotBySlug.get(outing.spotSlug);
    if (!spot) continue;
    const forecast = await getSpotForecast(spot);
    outingSlots.set(outing.id, slotAt(forecast.days, new Date(outing.plannedAt).getTime()));
  }

  const carnet = summarizeCatches(mine.catches);

  return (
    <div className="bg-page">
      <div className="mx-auto w-full max-w-shell px-4 py-8 md:px-8 md:py-12">
        <h1 className="font-serif text-h1 font-semibold">Votre compte</h1>

        {justDeleted && (
          <p role="status" className="surface mt-4 max-w-prose p-4 text-read text-fg">
            Votre compte a été supprimé, ainsi que vos avis, vos prises, vos favoris et vos sorties.
            Il ne reste rien de vous chez nous.
          </p>
        )}

        {errorKey && ERRORS[errorKey] && (
          <p role="alert" className="demo-frame mt-4 max-w-prose p-4 text-read text-fg">
            {ERRORS[errorKey]}
          </p>
        )}

        {!contributions.available ? (
          <section className="mt-6 max-w-prose">
            <p className="demo-frame p-4 text-read text-fg-muted">
              <strong className="font-600 text-fg">Les comptes ne sont pas encore ouverts.</strong>{' '}
              Ce déploiement ne dispose d’aucune base de données : il n’y a rien à quoi se
              connecter, et rien qui puisse être enregistré. Le formulaire viendra quand la base
              sera en place — pas avant, et sans faire semblant entre-temps.
            </p>
          </section>
        ) : user === null ? (
          <section aria-labelledby="connexion" className="mt-6 max-w-prose">
            <h2 id="connexion" className="font-serif text-h2 font-semibold">
              Se connecter
            </h2>
            <p className="mt-2 text-read text-fg-muted">
              Un compte sert à tenir un carnet de prises, suivre des spots, programmer des sorties
              et recevoir leurs conditions la veille. Il n’est jamais nécessaire pour consulter le
              site : tout ce qui est public le reste sans se connecter.
            </p>
            <p className="mt-2 text-read text-fg-muted">
              Il n’y a pas de mot de passe. Vous recevez un lien, vous cliquez, vous êtes connecté.
              Nous ne détenons donc aucun secret vous concernant.
            </p>

            <div className="surface mt-6 p-4">
              <SignInForm />
            </div>
          </section>
        ) : (
          <>
            <p className="mt-3 max-w-prose text-read text-fg-muted">
              Connecté avec{' '}
              <span className="nums text-fg">{user.email ?? 'une adresse vérifiée'}</span>.
            </p>

            {profile === null ? (
              <section aria-labelledby="profil" className="mt-8 max-w-prose">
                <h2 id="profil" className="font-serif text-h2 font-semibold">
                  Choisissez un nom affiché
                </h2>
                <p className="mt-2 text-read text-fg-muted">
                  Dernière étape avant de pouvoir contribuer. Ce nom est la seule chose que les
                  autres verront : votre adresse e-mail n’est jamais affichée. Les favoris et les
                  sorties, eux, n’ont pas besoin de nom — ils ne sont visibles que de vous.
                </p>
                <div className="surface mt-4 p-4">
                  <ProfileForm mode="create" />
                </div>
              </section>
            ) : (
              <section aria-labelledby="profil" className="mt-8 max-w-prose">
                <h2 id="profil" className="font-serif text-h2 font-semibold">
                  Profil
                </h2>
                <p className="mt-2 text-read text-fg-muted">
                  Vos contributions s’affichent sous{' '}
                  <strong className="font-600 text-fg">{profile.displayName}</strong>. Compte
                  créé le{' '}
                  <span className="nums">
                    {formatDateTime(new Date(profile.createdAt), TIME_ZONE)}
                  </span>
                  .
                </p>
                <div className="surface mt-4 p-4">
                  <ProfileForm mode="rename" currentName={profile.displayName} />
                </div>
              </section>
            )}

            {/* ── Sorties programmées ─────────────────────────────────────── */}
            <section aria-labelledby="sorties" className="mt-10">
              <h2 id="sorties" className="font-serif text-h2 font-semibold">
                Sorties programmées
              </h2>
              {upcoming.length === 0 ? (
                <p className="mt-2 max-w-prose text-read text-fg-muted">
                  Aucune sortie à venir. Programmez-en une depuis l’onglet « Espèces » d’un spot :
                  vous recevrez les conditions prévues la veille, par courriel, si vous le
                  demandez.
                </p>
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
                      <li key={outing.id} className="surface p-4">
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
              <h2 id="favoris" className="font-serif text-h2 font-semibold">
                Spots favoris
              </h2>
              {favoriteSummaries.length === 0 ? (
                <p className="mt-2 max-w-prose text-read text-fg-muted">
                  Aucun favori. Le bouton « Ajouter aux favoris » est en haut de chaque page de
                  spot ; vous retrouverez ici leur score du moment, en un coup d’œil.
                </p>
              ) : (
                <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {favoriteSummaries.map(({ spot, current, nextGood }) => {
                    const score = scoreOf(current);
                    return (
                      <li key={spot.slug}>
                        <Link
                          href={spotPath(spot)}
                          className="surface flex min-h-tap items-center justify-between gap-3 p-3 tappable"
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
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {/* ── Carnet de prises ─────────────────────────────────────────── */}
            <section aria-labelledby="carnet" className="mt-10">
              <h2 id="carnet" className="font-serif text-h2 font-semibold">
                Carnet de prises
              </h2>

              {carnet.total === 0 ? (
                <p className="mt-2 max-w-prose text-read text-fg-muted">
                  Rien encore. Les prises se déclarent depuis l’onglet « Espèces » d’un spot ; le
                  carnet se remplit tout seul, déclaration après déclaration.
                </p>
              ) : (
                <>
                  <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {[
                      { term: 'Prises', value: String(carnet.total) },
                      { term: 'Espèces', value: String(carnet.distinctSpecies) },
                      {
                        term: 'Relâchées',
                        value: carnet.releaseRate === null ? '—' : `${Math.round(carnet.releaseRate * 100)} %`,
                      },
                      {
                        term: 'Plus longue',
                        value: carnet.longest?.lengthCm ? `${carnet.longest.lengthCm} cm` : '—',
                      },
                    ].map(({ term, value }) => (
                      <div key={term} className="surface p-3">
                        <dt className="text-meta text-fg-muted">{term}</dt>
                        <dd className="mt-1 text-[22px] font-bold nums text-fg" data-numeric="">
                          {value}
                        </dd>
                      </div>
                    ))}
                  </dl>

                  <div className="mt-6 grid gap-6 lg:grid-cols-3">
                    <div>
                      <h3 className="card-title">Par espèce</h3>
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
                      <h3 className="card-title">Par spot</h3>
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
                      <h3 className="card-title">Douze derniers mois</h3>
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

                  <h3 className="card-title mt-8">
                    Toutes les prises{' '}
                    <span className="nums font-400 text-fg-muted">{mine.catches.length}</span>
                  </h3>
                  <ul className="mt-3 grid gap-3 md:grid-cols-2">
                    {mine.catches.map((entry) => (
                      <li key={entry.id} className="surface p-4">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                          <span className="text-body font-600 text-fg">
                            {entry.species}
                            {entry.lengthCm !== null && <span className="nums font-400 text-fg-muted"> · {entry.lengthCm} cm</span>}
                            {entry.released && <span className="font-400 text-fg-muted"> · relâché</span>}
                          </span>
                          <span className="text-body text-fg-muted">{nameOf(entry.spotSlug)}</span>
                        </div>
                        {entry.note && <p className="mt-2 max-w-prose text-body text-fg">{entry.note}</p>}
                        <div className="card-source mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span className="nums">{formatDateTime(new Date(entry.caughtAt), TIME_ZONE)}</span>
                          <form action={deleteCatch}>
                            <input type="hidden" name="catch_id" value={entry.id} />
                            <input type="hidden" name="spot_slug" value={entry.spotSlug} />
                            <button type="submit" className="underline decoration-dotted underline-offset-4 hover:text-fg">
                              Supprimer
                            </button>
                          </form>
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>

            {/* ── Avis ─────────────────────────────────────────────────────── */}
            {mine.reviews.length > 0 && (
              <section aria-labelledby="avis" className="mt-10">
                <h2 id="avis" className="font-serif text-h2 font-semibold">
                  Vos avis{' '}
                  <span className="nums font-400 text-fg-muted">{mine.reviews.length}</span>
                </h2>
                <ul className="mt-4 grid gap-3 md:grid-cols-2">
                  {mine.reviews.map((review) => (
                    <li key={review.id} className="surface p-4">
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

            {profile !== null && (
              <>
                <section aria-labelledby="donnees" className="mt-10 max-w-prose">
                  <h2 id="donnees" className="font-serif text-h2 font-semibold">
                    Vos données
                  </h2>
                  <p className="mt-2 text-read text-fg-muted">
                    Tout ce que nous détenons sur vous — profil, avis, prises, favoris, sorties —
                    tient dans un fichier que vous pouvez télécharger maintenant, sans nous le
                    demander et sans délai.
                  </p>
                  <p className="mt-4">
                    <a
                      href="/api/compte/export"
                      className="inline-flex min-h-tap items-center rounded-ctl border border-edge-strong px-5 font-600 text-fg hover:bg-surface-2"
                      download
                    >
                      Télécharger mes données (JSON)
                    </a>
                  </p>
                </section>

                <section aria-labelledby="effacer" className="mt-10 max-w-prose">
                  <h2 id="effacer" className="font-serif text-h2 font-semibold">
                    Effacer le compte
                  </h2>
                  <p className="mt-2 text-read text-fg-muted">
                    La suppression emporte le profil, les avis, les prises, les photos, les favoris
                    et les sorties. Elle est immédiate et sans retour possible. Nous ne gardons pas
                    de copie « au cas où » : ce serait exactement ce que l’effacement interdit.
                  </p>
                  <p className="mt-2 text-read text-fg-muted">
                    Pensez à exporter vos données avant, si vous voulez les garder.
                  </p>
                  <div className="surface mt-4 p-4">
                    <DeleteAccountForm />
                  </div>
                </section>
              </>
            )}

            <section className="mt-10">
              <form action={signOut}>
                <Button type="submit" variant="ghost">
                  Se déconnecter
                </Button>
              </form>
            </section>
          </>
        )}

        <p className="mt-12 max-w-prose text-body text-fg-muted">
          Ce que nous collectons, pourquoi, et pour combien de temps :{' '}
          <Link href="/confidentialite" className="underline decoration-dotted underline-offset-4">
            politique de confidentialité
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
