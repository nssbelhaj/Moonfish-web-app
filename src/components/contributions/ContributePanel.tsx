'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { CatchForm } from '@/components/contributions/CatchForm';
import { OutingForm } from '@/components/contributions/OutingForm';
import { ReviewForm } from '@/components/contributions/ReviewForm';


interface OwnReview {
  rating: number;
  comment: string | null;
}

interface AccountState {
  signedIn: boolean;
  hasProfile?: boolean;
  ownReview?: OwnReview | null;
}

type Action = 'avis' | 'prise' | 'sortie';

type Session =
  | { kind: 'loading' }
  | { kind: 'signed-out' }
  | { kind: 'no-profile' }
  | { kind: 'ready'; ownReview: OwnReview | null };

export function ContributePanel({
  spotSlug,
  spotPath,
  speciesSuggestions,
}: {
  spotSlug: string;
  spotPath: string;
  speciesSuggestions: readonly string[];
}) {
  const [session, setSession] = useState<Session>({ kind: 'loading' });
  const [action, setAction] = useState<Action>('avis');

  useEffect(() => {
    const controller = new AbortController();

    async function resolve(): Promise<void> {
      try {
        const response = await fetch(`/api/compte/etat?spot=${encodeURIComponent(spotSlug)}`, {
          signal: controller.signal,
          // Une réponse de session ne se met JAMAIS en cache : le navigateur
          // servirait l'état d'une autre personne sur un appareil partagé.
          cache: 'no-store',
        });

        if (!response.ok) return setSession({ kind: 'signed-out' });

        const state = (await response.json()) as AccountState;
        if (!state.signedIn) return setSession({ kind: 'signed-out' });
        if (!state.hasProfile) return setSession({ kind: 'no-profile' });

        // Le formulaire est PRÉ-REMPLI avec l'avis existant : un pêcheur qui
        // revient doit voir ce qu'il avait écrit, pas un champ vide qui
        // donnerait l'impression que son avis a disparu.
        setSession({ kind: 'ready', ownReview: state.ownReview ?? null });
      } catch {
        // Requête annulée ou réseau absent : on retombe sur l'état non
        // connecté, qui propose simplement le lien de connexion.
        if (!controller.signal.aborted) setSession({ kind: 'signed-out' });
      }
    }

    void resolve();
    return () => controller.abort();
  }, [spotSlug]);

  if (session.kind === 'loading') return null;

  if (session.kind === 'signed-out') {
    return (
      <p className="surface max-w-prose p-4 text-read text-fg-muted">
        Pour noter ce spot ou déclarer une prise,{' '}
        <Link
          href={`/compte?next=${encodeURIComponent(`${spotPath}/especes`)}`}
          className="text-fg underline decoration-dotted underline-offset-4"
        >
          connectez-vous
        </Link>
        . Un compte se crée en une minute, avec une adresse e-mail et un mot de passe. Il ne demande jamais votre position.
      </p>
    );
  }

  if (session.kind === 'no-profile') {
    return (
      <p className="surface max-w-prose p-4 text-read text-fg-muted">
        Dernière étape avant de contribuer :{' '}
        <Link href="/compte" className="text-fg underline decoration-dotted underline-offset-4">
          choisissez un nom affiché
        </Link>
        .
      </p>
    );
  }

  const own = session.ownReview;

  /*
    Une action à la fois. Trois formulaires côte à côte tenaient en colonnes
    étroites sur grand écran et s'empilaient sur trois hauteurs d'écran sur
    mobile ; on choisit ce qu'on vient faire, et le formulaire prend la place.
  */
  const ACTIONS: { cle: Action; libelle: string; sous: string }[] = [
    {
      cle: 'avis',
      libelle: own ? 'Votre avis' : 'Noter ce spot',
      sous: 'Un avis par personne et par spot ; vous pouvez le réviser quand vous voulez.',
    },
    { cle: 'prise', libelle: 'Déclarer une prise', sous: 'Rien n’est obligatoire hormis l’espèce et le moment.' },
    {
      cle: 'sortie',
      libelle: 'Programmer une sortie',
      sous: 'Et recevoir la veille, par courriel, les conditions prévues à cette heure-là.',
    },
  ];
  const courante = ACTIONS.find((a) => a.cle === action) ?? ACTIONS[0];

  return (
    <div className="surface p-4 md:p-6">
      <div className="segments-compte max-w-[40rem]" role="tablist" aria-label="Contribuer">
        {ACTIONS.map((a) => (
          <button
            key={a.cle}
            type="button"
            role="tab"
            id={`contribuer-${a.cle}`}
            aria-selected={action === a.cle}
            aria-controls={`contribuer-panneau-${a.cle}`}
            className="onglet-compte"
            data-actif={action === a.cle ? '' : undefined}
            onClick={() => setAction(a.cle)}
          >
            {a.libelle}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id={`contribuer-panneau-${courante?.cle ?? 'avis'}`}
        aria-labelledby={`contribuer-${courante?.cle ?? 'avis'}`}
        className="mt-5 max-w-[40rem]"
      >
        <p className="text-body text-fg-muted">{courante?.sous}</p>
        <div className="mt-4">
          {action === 'avis' && (
            <ReviewForm
              spotSlug={spotSlug}
              spotPath={spotPath}
              {...(own ? { existing: { rating: own.rating, comment: own.comment } } : {})}
            />
          )}
          {action === 'prise' && (
            <CatchForm spotSlug={spotSlug} spotPath={spotPath} speciesSuggestions={speciesSuggestions} />
          )}
          {action === 'sortie' && <OutingForm spotSlug={spotSlug} spotPath={spotPath} />}
        </div>
      </div>
    </div>
  );
}
