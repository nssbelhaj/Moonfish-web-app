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
        . Un compte demande une adresse e-mail, rien d’autre : ni mot de passe, ni nom, ni position.
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

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="surface p-4">
        <h3 className="card-title">{own ? 'Votre avis sur ce spot' : 'Noter ce spot'}</h3>
        <p className="mt-1 text-meta text-fg-muted">
          Un avis par personne et par spot ; vous pouvez le réviser quand vous voulez.
        </p>
        <div className="mt-4">
          <ReviewForm
            spotSlug={spotSlug}
            spotPath={spotPath}
            {...(own ? { existing: { rating: own.rating, comment: own.comment } } : {})}
          />
        </div>
      </div>

      <div className="surface p-4">
        <h3 className="card-title">Déclarer une prise</h3>
        <p className="mt-1 text-meta text-fg-muted">
          Rien n’est obligatoire hormis l’espèce et le moment.
        </p>
        <div className="mt-4">
          <CatchForm
            spotSlug={spotSlug}
            spotPath={spotPath}
            speciesSuggestions={speciesSuggestions}
          />
        </div>
      </div>

      <div className="surface p-4">
        <h3 className="card-title">Programmer une sortie</h3>
        <p className="mt-1 text-meta text-fg-muted">
          Et recevoir la veille, par courriel, les conditions prévues à cette heure-là.
        </p>
        <div className="mt-4">
          <OutingForm spotSlug={spotSlug} spotPath={spotPath} />
        </div>
      </div>
    </div>
  );
}
