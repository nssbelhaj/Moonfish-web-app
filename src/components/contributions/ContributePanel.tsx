'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { CatchForm } from '@/components/contributions/CatchForm';
import { ReviewForm } from '@/components/contributions/ReviewForm';
import { supabaseBrowser } from '@/lib/supabase/browser';

interface OwnReview {
  rating: number;
  comment: string | null;
}

type Session =
  | { kind: 'loading' }
  | { kind: 'signed-out' }
  | { kind: 'no-profile' }
  | { kind: 'ready'; userId: string; ownReview: OwnReview | null };

/**
 * Zone de contribution, résolue DANS LE NAVIGATEUR.
 *
 * Pourquoi côté client alors que tout le reste du site est rendu au serveur :
 * lire la session sur le serveur veut dire lire les cookies, et lire les
 * cookies bascule la route entière en rendu dynamique. La page des espèces —
 * qui est d'abord du contenu éditorial identique pour tout le monde — aurait
 * alors perdu son pré-rendu et son cache d'une heure, pour un encadré de
 * formulaire.
 *
 * Le compromis est explicite : cet encadré apparaît après l'hydratation, une
 * fraction de seconde plus tard que le reste. Les listes d'avis et de prises,
 * elles, sont bien rendues au serveur — ce sont elles qui doivent être lisibles
 * sans JavaScript et indexables.
 *
 * Rien de sensible ne dépend de cette lecture : la session est REVÉRIFIÉE au
 * serveur à chaque écriture, et la base refuserait de toute façon une écriture
 * au nom d'autrui.
 */
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
    let cancelled = false;

    async function resolve(): Promise<void> {
      const client = supabaseBrowser();
      if (!client) return setSession({ kind: 'signed-out' });

      const { data, error } = await client.auth.getUser();
      if (cancelled) return;
      if (error || !data.user) return setSession({ kind: 'signed-out' });

      // La politique RLS n'autorise la lecture que de SON propre profil : cette
      // requête ne peut rien apprendre sur les autres comptes.
      const [{ data: profile }, { data: review }] = await Promise.all([
        client.from('profiles').select('id').eq('id', data.user.id).maybeSingle(),
        client
          .from('spot_reviews')
          .select('rating, comment')
          .eq('spot_slug', spotSlug)
          .eq('user_id', data.user.id)
          .maybeSingle(),
      ]);

      if (cancelled) return;
      if (!profile) return setSession({ kind: 'no-profile' });

      // Le formulaire est PRÉ-REMPLI avec l'avis existant : un pêcheur qui
      // revient doit voir ce qu'il avait écrit, pas un champ vide qui donnerait
      // l'impression que son avis a disparu.
      setSession({
        kind: 'ready',
        userId: data.user.id,
        ownReview: review ? { rating: review.rating, comment: review.comment } : null,
      });
    }

    void resolve();
    return () => {
      cancelled = true;
    };
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
    <div className="grid gap-6 lg:grid-cols-2">
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
            userId={session.userId}
            speciesSuggestions={speciesSuggestions}
          />
        </div>
      </div>
    </div>
  );
}
