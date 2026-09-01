'use client';

import Link from 'next/link';
import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { distanceKm } from '@/lib/geo';

export interface LocatableSpot {
  slug: string;
  name: string;
  regionLabel: string;
  path: string;
  lat: number;
  lng: number;
}

type State =
  | { kind: 'idle' }
  | { kind: 'asking' }
  | { kind: 'found'; nearest: (LocatableSpot & { km: number })[] }
  | { kind: 'refused' }
  | { kind: 'failed'; message: string }
  | { kind: 'unsupported' };

/** Au-delà, « le plus proche » n'a plus de sens pour une sortie de pêche. */
const MAX_RADIUS_KM = 250;
const HOW_MANY = 3;

/**
 * Spots les plus proches de l'appareil.
 *
 * ═══ La position ne quitte JAMAIS le navigateur. ═══
 *
 * Le calcul se fait ici, contre la liste des spots qui est déjà publique et
 * déjà chargée dans la page. Rien n'est envoyé, rien n'est enregistré, rien
 * n'est journalisé — il n'existe aucun point d'accès serveur qui accepterait
 * une position, ce qui est plus solide qu'une promesse de ne pas s'en servir.
 *
 * La position d'un pêcheur est une donnée sensible en pratique : elle dit où
 * il est, à quelle heure, et par recoupement où il pêche. La meilleure façon
 * de la protéger est de ne pas la recevoir.
 *
 * La demande d'autorisation part d'un CLIC, jamais du chargement de la page.
 * Un site qui réclame la géolocalisation à l'arrivée entraîne au refus
 * réflexe, et ce refus vaut ensuite pour les fois où la fonction servirait.
 */
export function NearbySpots({ spots }: { spots: readonly LocatableSpot[] }) {
  const [state, setState] = useState<State>({ kind: 'idle' });

  function locate(): void {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      return setState({ kind: 'unsupported' });
    }

    setState({ kind: 'asking' });

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const here = { lat: position.coords.latitude, lng: position.coords.longitude };

        const nearest = spots
          .map((spot) => ({ ...spot, km: distanceKm(here, spot) }))
          .filter((spot) => spot.km <= MAX_RADIUS_KM)
          .sort((a, b) => a.km - b.km)
          .slice(0, HOW_MANY);

        setState({ kind: 'found', nearest });
      },
      (error) => {
        // `PERMISSION_DENIED` vaut 1. Un refus n'est pas une panne : il ne
        // mérite ni message d'erreur rouge, ni invitation à réessayer.
        if (error.code === 1) return setState({ kind: 'refused' });
        setState({
          kind: 'failed',
          message: 'Position introuvable. Cela arrive à l’intérieur d’un bâtiment ou sans signal.',
        });
      },
      // Pas de haute précision : la rue exacte ne changerait rien au classement
      // des spots, et la demander coûte de la batterie et du temps. Un point à
      // cinq minutes d'ancienneté fait parfaitement l'affaire.
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  }

  return (
    <div className="surface p-4">
      <h2 className="card-title">Les spots les plus proches</h2>
      <p className="mt-2 max-w-prose text-body text-fg-muted">
        Votre position sert au calcul <strong className="font-600 text-fg">dans ce navigateur</strong>{' '}
        et n’est envoyée nulle part : aucun serveur du site ne sait la recevoir.
      </p>

      {state.kind === 'idle' && (
        <div className="mt-4">
          <Button type="button" variant="secondary" onClick={locate}>
            Trouver les spots près de moi
          </Button>
        </div>
      )}

      {state.kind === 'asking' && (
        <p role="status" className="mt-4 text-body text-fg-muted">
          Votre navigateur vous demande l’autorisation…
        </p>
      )}

      {state.kind === 'refused' && (
        <p role="status" className="mt-4 max-w-prose text-body text-fg-muted">
          Autorisation refusée — c’est un choix parfaitement légitime. La{' '}
          <Link href="/carte" className="underline decoration-dotted underline-offset-4">
            carte
          </Link>{' '}
          et les filtres de cette page font le même travail à la main.
        </p>
      )}

      {state.kind === 'unsupported' && (
        <p role="status" className="mt-4 text-body text-fg-muted">
          Ce navigateur ne sait pas donner de position. Passez par la carte.
        </p>
      )}

      {state.kind === 'failed' && (
        <p role="alert" className="mt-4 max-w-prose text-body text-fg-muted">
          {state.message}
        </p>
      )}

      {state.kind === 'found' &&
        (state.nearest.length === 0 ? (
          <p role="status" className="mt-4 max-w-prose text-body text-fg-muted">
            Aucun spot suivi à moins de <span className="nums">{MAX_RADIUS_KM}</span> km. Nous n’en
            couvrons que douze pour l’instant, et il se peut qu’aucun ne soit près de vous.
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {state.nearest.map((spot) => (
              <li key={spot.slug}>
                <Link
                  href={spot.path}
                  className="flex min-h-tap items-baseline justify-between gap-3 rounded-ctl px-1 tappable"
                >
                  <span className="text-body font-600 text-fg">
                    {spot.name}{' '}
                    <span className="font-400 text-fg-muted">{spot.regionLabel}</span>
                  </span>
                  <span className="nums shrink-0 text-body text-fg-muted" data-numeric="">
                    {spot.km < 10
                      ? `${spot.km.toFixed(1).replace('.', ',')} km`
                      : `${Math.round(spot.km)} km`}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ))}
    </div>
  );
}
