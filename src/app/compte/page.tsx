import type { Metadata } from 'next';
import Link from 'next/link';

import { EnteteCompte } from '@/components/account/EnteteCompte';
import { ProfileForm } from '@/components/account/ProfileForm';
import { scoreOf } from '@/components/account/score';
import { PanneauCarnet } from '@/components/account/panneaux/Carnet';
import { PanneauDonnees } from '@/components/account/panneaux/Donnees';
import { PanneauPreferences } from '@/components/account/panneaux/Preferences';
import { PanneauProfil } from '@/components/account/panneaux/Profil';
import { PanneauSorties } from '@/components/account/panneaux/Sorties';
import type { SpotChoice } from '@/components/contributions/CatchForm';
import { ConnexionForm, InscriptionForm } from '@/components/account/AuthForms';
import { SignInForm } from '@/components/account/SignInForm';
import { Button } from '@/components/ui/Button';
import { SPECIES } from '@/data/species';
import { summarizeCatches } from '@/lib/contributions/catch-log';
import { signOut } from '@/lib/auth/actions';
import { getSpotForecast, getSpotSummary, type ForecastSlot } from '@/lib/forecast';
import { contributions, spots as spotRepository } from '@/lib/providers';
import { absoluteUrl, spotPath } from '@/lib/routes';
import { currentUser } from '@/lib/auth/session';
import { googleEnabled, magicLinkEnabled } from '@/lib/auth/config';
import { connecterAvecGoogle } from '@/lib/auth/actions-compte';
import { estProprietaire } from '@/lib/auth/proprietaire';

/** Une page de compte ne se met pas en cache : elle dépend de la session. */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Votre compte',
  description:
    'Se connecter à Luna Marea : carnet de prises, spots favoris, sorties programmées, export et effacement de ses données.',
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

/**
 * Les erreurs d'Auth.js arrivent sous `?error=`, avec ses codes à lui. On ne
 * les affiche jamais tels quels : « OAuthCallbackError » ne dit rien à
 * personne, et « Configuration » désigne un problème qui n'est pas celui de
 * la personne devant l'écran.
 */
const ERREURS_AUTHJS: Record<string, string> = {
  OAuthSignin: 'La connexion avec Google n’a pas pu démarrer. Réessayez, ou utilisez votre adresse et un mot de passe.',
  OAuthCallbackError: 'Google n’a pas confirmé la connexion. Réessayez, ou utilisez votre adresse et un mot de passe.',
  OAuthCallback: 'Google n’a pas confirmé la connexion. Réessayez, ou utilisez votre adresse et un mot de passe.',
  Callback: 'La connexion n’a pas abouti. Réessayez.',
  AccessDenied: 'Google a refusé l’accès, ou vous l’avez annulé. Rien n’a été créé.',
  OAuthAccountNotLinked:
    'Cette adresse est déjà utilisée par un compte créé autrement. Connectez-vous avec votre mot de passe.',
  Configuration:
    'La connexion Google n’est pas correctement configurée sur ce site. Ce n’est pas de votre fait : utilisez votre adresse et un mot de passe.',
};


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
  const erreurAuthjs = typeof params.error === 'string' ? params.error : null;
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

  /*
    De quoi déclarer une prise sans quitter le carnet : la liste des spots,
    groupée par région, et le catalogue d'espèces en suggestions. La liste est
    OUVERTE — on peut saisir une espèce qui n'y figure pas, sans quoi nos
    propres données porteraient un silence là où le catalogue est incomplet.
  */
  const spotChoices: SpotChoice[] = allSpots.map((spot) => ({
    slug: spot.slug,
    name: spot.name,
    regionName: spot.regionName,
  }));
  const especesConnues = SPECIES.map((species) => species.name);

  /*
    Visible du seul compte qui a déployé le site — le premier inscrit. Cet
    écran a manqué pendant six échanges : l'état du déploiement n'était lisible
    qu'avec un secret qu'on ne retrouvait pas, dans un terminal. Il est calculé
    ici parce qu'il apparaît à deux endroits selon qu'un nom affiché existe ou
    non, et qu'une condition asynchrone ne se répète pas dans du JSX.
  */
  const exploitation = (await estProprietaire()) ? (
    <section aria-labelledby="exploitation" className="mt-10 max-w-prose">
      <h2 id="exploitation" className="font-serif text-h2 font-semibold">
        Exploitation du site
      </h2>
      <p className="mt-2 text-read text-fg-muted">
        Vous êtes le premier compte inscrit : vous pouvez consulter l’état de la configuration —
        base, courriel, marées, migrations — sans terminal ni secret.
      </p>
      <p className="mt-3">
        <Link href="/compte/diagnostic" className="underline decoration-dotted underline-offset-4">
          Voir l’état du déploiement
        </Link>
      </p>
    </section>
  ) : null;

  return (
    <div className="bg-page">
      <div className="mx-auto w-full max-w-shell px-4 py-8 md:px-8 md:py-12">
        {(user === null || profile === null) && (
          <h1 className="font-serif text-h1 font-semibold">Votre compte</h1>
        )}

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

        {erreurAuthjs && (
          <p role="alert" className="demo-frame mt-4 max-w-prose p-4 text-read text-fg">
            {ERREURS_AUTHJS[erreurAuthjs] ?? 'La connexion n’a pas abouti. Réessayez.'}
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
          <section aria-labelledby="connexion" className="mt-6">
            <h2 id="connexion" className="font-serif text-h2 font-semibold">
              Se connecter ou créer un compte
            </h2>
            <p className="mt-2 max-w-prose text-read text-fg-muted">
              Un compte sert à tenir un carnet de prises, suivre des spots, programmer des sorties
              et recevoir leurs conditions la veille. Il n’est jamais nécessaire pour consulter le
              site : tout ce qui est public le reste sans se connecter.
            </p>

            {/*
              Le formulaire est CONTRAINT en largeur, pas étiré sur la colonne.
              Un champ d'adresse e-mail large de sept cents pixels n'aide
              personne à le remplir, et la page devient un mur de rectangles.
              Vingt-huit rem cadrent la ligne de saisie sans la serrer.
            */}
            {googleEnabled() && (
              /*
                Un seul bouton, au-dessus des deux onglets : il sert autant à
                se connecter qu'à créer un compte, Google ne fait pas la
                différence. Le logo est un SVG en ligne, en monochrome : aucune
                requête vers Google avant le clic, et aucun littéral de couleur —
                la règle du site vaut aussi pour les marques des autres.
              */
              <form action={connecterAvecGoogle} className="mt-6 w-full max-w-[28rem]">
                <button type="submit" className="bouton-google">
                  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
                    <path fill="currentColor" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.8-6.8C35.6 2.4 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.3l7.9 6.1C12.4 13.7 17.7 9.5 24 9.5z" />
                    <path fill="currentColor" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.5-4.1 7-10.2 7-17.6z" />
                    <path fill="currentColor" d="M10.5 28.6A14.5 14.5 0 0 1 9.7 24c0-1.6.3-3.2.8-4.6l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.7l7.9-6.1z" />
                    <path fill="currentColor" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.3 0-11.6-4.2-13.5-9.9l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
                  </svg>
                  Continuer avec Google
                </button>
                <p className="mt-2 text-meta text-fg-muted">
                  Google saura que vous ouvrez une session ici — pas ce que vous y consultez. Rien ne
                  part vers Google avant ce clic.
                </p>
              </form>
            )}

            <div className="onglets-compte mt-6 w-full max-w-[28rem]">
              <nav className="segments-compte" aria-label="Connexion ou inscription">
                <a href="#connexion-panneau" className="onglet-compte">
                  J’ai un compte
                </a>
                <a href="#inscription-panneau" className="onglet-compte">
                  Créer un compte
                </a>
              </nav>

              <section
                id="connexion-panneau"
                className="surface mt-4 p-5"
                aria-label="Se connecter"
              >
                <ConnexionForm />
              </section>

              <section
                id="inscription-panneau"
                className="surface mt-4 p-5"
                aria-label="Créer un compte"
              >
                <p className="mb-4 text-body text-fg-muted">
                  Vos nom et date de naissance restent privés. Seul votre prénom apparaît sous vos
                  contributions, et vous pouvez le changer.
                </p>
                <InscriptionForm />
              </section>

              {magicLinkEnabled() ? (
                <details className="surface mt-4 p-5">
                  <summary className="cursor-pointer text-body text-fg">
                    Recevoir plutôt un lien par courriel
                  </summary>
                  <p className="mt-3 text-body text-fg-muted">
                    Sans mot de passe à retenir. Le lien vaut une heure et ne sert qu’une fois.
                  </p>
                  <div className="mt-3">
                    <SignInForm />
                  </div>
                </details>
              ) : (
                <p className="demo-frame mt-4 p-4 text-body text-fg-muted">
                  <strong className="font-600 text-fg">
                    L’envoi de courriel n’est pas configuré sur ce site.
                  </strong>{' '}
                  La récupération d’un mot de passe oublié est donc indisponible. Choisissez un mot
                  de passe que vous saurez retrouver.
                </p>
              )}
            </div>
          </section>
        ) : (
          <>
            {profile === null ? (
              <section aria-labelledby="profil" className="mt-8 max-w-prose">
                <h2 id="profil" className="panneau-titre">
                  Choisissez un nom affiché
                </h2>
                <p className="panneau-chapo">
                  Dernière étape avant de pouvoir contribuer. Ce nom est la seule chose que les
                  autres verront : votre adresse e-mail n’est jamais affichée. La date de naissance
                  ne sert qu’à vérifier l’âge, et n’est montrée à personne.
                </p>
                <div className="fiche mt-6">
                  <ProfileForm
                    mode="create"
                    {...(user.name ? { currentName: user.name.split(/\s+/)[0] ?? '' } : {})}
                  />
                </div>
              </section>
            ) : (
              <>
                <EnteteCompte
                  profil={profile}
                  email={user.email}
                  prises={carnet.total}
                  especes={carnet.distinctSpecies}
                  spots={carnet.bySpot.length}
                  favoris={favorites.length}
                  sorties={upcoming.length}
                />

                {/*
                  Cinq onglets plutôt qu'une page qui déroule. Ils tiennent en CSS
                  pure : chaque onglet est un lien vers son panneau, et `:target`
                  fait le reste. Aucun JavaScript, donc rien à charger, et la
                  page reste entièrement lisible si le sélecteur `:has()` manque —
                  les panneaux s'affichent alors les uns sous les autres.
                */}
                <div className="espace-compte mt-6">
                  <nav className="onglets-espace" aria-label="Sections de votre compte">
                    <a href="#espace-profil" className="onglet-espace">
                      Profil
                    </a>
                    <a href="#espace-carnet" className="onglet-espace">
                      Carnet
                    </a>
                    <a href="#espace-sorties" className="onglet-espace">
                      Sorties
                    </a>
                    <a href="#espace-preferences" className="onglet-espace">
                      Préférences
                    </a>
                    <a href="#espace-donnees" className="onglet-espace">
                      Données
                    </a>
                  </nav>

                  <section id="espace-profil" className="panneau-espace mt-6" aria-label="Profil">
                    <PanneauProfil profil={profile} />
                  </section>

                  <section id="espace-carnet" className="panneau-espace mt-6" aria-label="Carnet de prises">
                    <PanneauCarnet
                      carnet={carnet}
                      catches={mine.catches}
                      reviews={mine.reviews}
                      outings={upcoming}
                      favoris={favorites.length}
                      nameOf={nameOf}
                      spotChoices={spotChoices}
                      especesConnues={especesConnues}
                    />
                  </section>

                  <section id="espace-sorties" className="panneau-espace mt-6" aria-label="Sorties et favoris">
                    <PanneauSorties
                      upcoming={upcoming}
                      outingSlots={outingSlots}
                      favoriteSummaries={favoriteSummaries}
                      nameOf={nameOf}
                      pathOf={pathOf}
                      scoreOf={scoreOf}
                    />
                  </section>

                  <section id="espace-preferences" className="panneau-espace mt-6" aria-label="Préférences">
                    <PanneauPreferences profil={profile} />
                  </section>

                  <section id="espace-donnees" className="panneau-espace mt-6" aria-label="Vos données">
                    <PanneauDonnees exploitation={exploitation} />
                  </section>
                </div>
              </>
            )}

            {/*
              Sans nom affiché il n’y a pas encore d’onglets : le panneau
              d’exploitation doit tout de même être atteignable, car c’est le
              premier inscrit qui en a besoin, souvent avant d’avoir rempli quoi
              que ce soit.
            */}
            {profile === null && exploitation}

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
