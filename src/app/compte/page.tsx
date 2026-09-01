import type { Metadata } from 'next';
import Link from 'next/link';

import { DeleteAccountForm } from '@/components/account/DeleteAccountForm';
import { ProfileForm } from '@/components/account/ProfileForm';
import { SignInForm } from '@/components/account/SignInForm';
import { Button } from '@/components/ui/Button';
import { contributions } from '@/lib/providers';
import { deleteCatch, deleteReview, signOut } from '@/lib/auth/actions';
import { absoluteUrl } from '@/lib/routes';
import { currentUser } from '@/lib/supabase/server';
import { formatDateTime } from '@/lib/time';

/** Une page de compte ne se met pas en cache : elle dépend de la session. */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Votre compte',
  description:
    'Se connecter à Moonfish pour déclarer des prises et noter des spots, exporter ses données ou effacer son compte.',
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
  const mine = user
    ? await contributions.listForUser(user.id)
    : { reviews: [], catches: [] };

  return (
    <div className="bg-page">
      <div className="mx-auto w-full max-w-shell px-4 py-8 md:px-8 md:py-12">
        <h1 className="font-serif text-h1 font-semibold">Votre compte</h1>

        {justDeleted && (
          <p role="status" className="surface mt-4 max-w-prose p-4 text-read text-fg">
            Votre compte a été supprimé, ainsi que vos avis et vos prises déclarées. Il ne reste
            rien de vous chez nous.
          </p>
        )}

        {errorKey && ERRORS[errorKey] && (
          <p role="alert" className="demo-frame mt-4 max-w-prose p-4 text-read text-fg">
            {ERRORS[errorKey]}
          </p>
        )}

        {!contributions.available ? (
          <section className="mt-6 max-w-prose">
            {/*
              Ni formulaire, ni bouton grisé : quand les comptes ne sont pas
              configurés, la page le DIT. Un champ de connexion qui répondrait
              par une erreur ferait douter la personne de son adresse plutôt que
              de notre déploiement.
            */}
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
              Un compte sert à déclarer des prises et à noter un spot. Il n’est jamais nécessaire
              pour consulter le site : tout ce qui est public le reste sans se connecter.
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
                  autres verront : votre adresse e-mail n’est jamais affichée.
                </p>
                <div className="surface mt-4 p-4">
                  <ProfileForm mode="create" />
                </div>
              </section>
            ) : (
              <>
                <section aria-labelledby="profil" className="mt-8 max-w-prose">
                  <h2 id="profil" className="font-serif text-h2 font-semibold">
                    Profil
                  </h2>
                  <p className="mt-2 text-read text-fg-muted">
                    Vos contributions s’affichent sous{' '}
                    <strong className="font-600 text-fg">{profile.displayName}</strong>. Compte
                    créé le{' '}
                    <span className="nums">
                      {formatDateTime(new Date(profile.createdAt), 'Europe/Paris')}
                    </span>
                    .
                  </p>
                  <div className="surface mt-4 p-4">
                    <ProfileForm mode="rename" currentName={profile.displayName} />
                  </div>
                </section>

                <section aria-labelledby="mes-contributions" className="mt-10">
                  <h2 id="mes-contributions" className="font-serif text-h2 font-semibold">
                    Vos contributions
                  </h2>

                  {mine.reviews.length === 0 && mine.catches.length === 0 ? (
                    <p className="mt-2 max-w-prose text-read text-fg-muted">
                      Rien pour l’instant. Les avis et les prises se déclarent depuis l’onglet
                      « Espèces » d’un spot.
                    </p>
                  ) : (
                    <div className="mt-4 grid gap-6 lg:grid-cols-2">
                      <div>
                        <h3 className="card-title">
                          Avis <span className="nums font-400 text-fg-muted">{mine.reviews.length}</span>
                        </h3>
                        <ul className="mt-3 space-y-3">
                          {mine.reviews.map((review) => (
                            <li key={review.id} className="surface p-4">
                              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                                <span className="text-body font-600 text-fg">{review.spotSlug}</span>
                                <span className="nums text-body text-fg-muted">{review.rating}/5</span>
                              </div>
                              {review.comment && (
                                <p className="mt-2 max-w-prose text-body text-fg">{review.comment}</p>
                              )}
                              <div className="card-source mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
                                <span className="nums">
                                  {formatDateTime(new Date(review.createdAt), 'Europe/Paris')}
                                </span>
                                <form action={deleteReview}>
                                  <input type="hidden" name="review_id" value={review.id} />
                                  <input type="hidden" name="spot_slug" value={review.spotSlug} />
                                  <button
                                    type="submit"
                                    className="underline decoration-dotted underline-offset-4 hover:text-fg"
                                  >
                                    Supprimer
                                  </button>
                                </form>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <h3 className="card-title">
                          Prises <span className="nums font-400 text-fg-muted">{mine.catches.length}</span>
                        </h3>
                        <ul className="mt-3 space-y-3">
                          {mine.catches.map((entry) => (
                            <li key={entry.id} className="surface p-4">
                              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                                <span className="text-body font-600 text-fg">{entry.species}</span>
                                <span className="text-body text-fg-muted">{entry.spotSlug}</span>
                              </div>
                              <div className="card-source mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
                                <span className="nums">
                                  {formatDateTime(new Date(entry.caughtAt), 'Europe/Paris')}
                                </span>
                                <form action={deleteCatch}>
                                  <input type="hidden" name="catch_id" value={entry.id} />
                                  <input type="hidden" name="spot_slug" value={entry.spotSlug} />
                                  <button
                                    type="submit"
                                    className="underline decoration-dotted underline-offset-4 hover:text-fg"
                                  >
                                    Supprimer
                                  </button>
                                </form>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </section>

                <section aria-labelledby="donnees" className="mt-10 max-w-prose">
                  <h2 id="donnees" className="font-serif text-h2 font-semibold">
                    Vos données
                  </h2>
                  <p className="mt-2 text-read text-fg-muted">
                    Tout ce que nous détenons sur vous — profil, avis, prises déclarées — tient
                    dans un fichier que vous pouvez télécharger maintenant, sans nous le demander
                    et sans délai.
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
                    La suppression emporte le profil, les avis, les prises déclarées et les photos.
                    Elle est immédiate et sans retour possible. Nous ne gardons pas de copie « au
                    cas où » : ce serait exactement ce que l’effacement interdit.
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
