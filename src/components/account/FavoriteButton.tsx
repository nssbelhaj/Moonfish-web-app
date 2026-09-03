'use client';

import Link from 'next/link';
import { useActionState, useEffect, useState } from 'react';

import { toggleFavorite } from '@/lib/auth/actions';

/**
 * Le bouton « favori » d'un spot.
 *
 * ─── Pourquoi il lit la session lui-même ──────────────────────────────────
 *
 * Les pages de spot sont PRÉ-RENDUES : lire les cookies dans la page
 * basculerait toute la route en dynamique et ferait perdre le cache d'une
 * heure à douze spots pour un bouton. Le composant demande donc son état à
 * `/api/compte/etat`, comme le panneau de contribution — même raison, même
 * mécanique.
 *
 * Tant que l'état n'est pas connu, RIEN ne s'affiche. Un cœur vide qui se
 * remplirait une seconde après le chargement ferait croire à un clic fantôme.
 */

type Etat =
  | { kind: 'inconnu' }
  | { kind: 'deconnecte' }
  | { kind: 'connecte'; favori: boolean };

export function FavoriteButton({ spotSlug, spotPath }: { spotSlug: string; spotPath: string }) {
  const [etat, setEtat] = useState<Etat>({ kind: 'inconnu' });

  useEffect(() => {
    const controller = new AbortController();

    fetch(`/api/compte/etat?spot=${encodeURIComponent(spotSlug)}`, {
      signal: controller.signal,
      cache: 'no-store',
    })
      .then((r) => (r.ok ? r.json() : { signedIn: false }))
      .then((s: { signedIn: boolean; favorite?: boolean }) =>
        setEtat(s.signedIn ? { kind: 'connecte', favori: s.favorite === true } : { kind: 'deconnecte' }),
      )
      .catch(() => {
        if (!controller.signal.aborted) setEtat({ kind: 'deconnecte' });
      });

    return () => controller.abort();
  }, [spotSlug]);

  const [resultat, action, pending] = useActionState(toggleFavorite, null);

  // Après une action réussie, l'état local suit ce qui vient d'être fait :
  // recharger la session pour un cœur qui change de couleur serait excessif.
  useEffect(() => {
    if (resultat?.ok && etat.kind === 'connecte') {
      setEtat({ kind: 'connecte', favori: resultat.message.startsWith('Ajouté') });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultat]);

  if (etat.kind === 'inconnu') return null;

  if (etat.kind === 'deconnecte') {
    return (
      <Link
        href={`/compte?next=${encodeURIComponent(spotPath)}`}
        className="inline-flex min-h-tap items-center gap-2 rounded-ctl border border-edge-strong px-4 text-body text-fg-muted hover:text-fg"
      >
        <span aria-hidden="true">☆</span> Suivre ce spot
      </Link>
    );
  }

  const favori = etat.favori;

  return (
    <form action={action} className="inline-flex flex-col items-start gap-1">
      <input type="hidden" name="spot_slug" value={spotSlug} />
      <input type="hidden" name="favori" value={favori ? 'non' : 'oui'} />
      <button
        type="submit"
        disabled={pending}
        aria-pressed={favori}
        className={`inline-flex min-h-tap items-center gap-2 rounded-ctl border px-4 text-body transition-colors ${
          favori
            ? 'border-accent bg-surface-2 text-fg'
            : 'border-edge-strong text-fg-muted hover:text-fg'
        }`}
      >
        <span aria-hidden="true">{favori ? '★' : '☆'}</span>
        {favori ? 'Dans vos favoris' : 'Ajouter aux favoris'}
      </button>
      {resultat && !resultat.ok && (
        <span role="alert" className="text-meta text-danger">
          {resultat.message}
        </span>
      )}
    </form>
  );
}
