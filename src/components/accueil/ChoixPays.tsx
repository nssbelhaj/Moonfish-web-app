'use client';

import { useEffect, useState } from 'react';

import { formatScore } from '@/lib/score-display';

import { MiniCarte, type PointCarte } from './MiniCarte';

/**
 * Le choix du pays, en tête de la page d'accueil.
 *
 * ─── Le problème qu'il résout ─────────────────────────────────────────────
 *
 * L'accueil montrait les meilleurs créneaux du catalogue entier, tous pays
 * confondus. Pour quelqu'un qui pêche en Bretagne, c'était souvent une liste
 * de spots marocains : exacts, bien classés, et sans le moindre intérêt. Un
 * bon score à deux mille kilomètres n'est pas une information, c'est du
 * bruit.
 *
 * ─── Masquer plutôt que recharger ─────────────────────────────────────────
 *
 * Même procédé que les filtres de `/spots` : le serveur rend TOUT, chaque
 * bloc portant son `data-pays`, et le choix masque le reste. Aucune requête,
 * aucun score recalculé côté client, et la page reste entièrement lisible
 * sans JavaScript — dans ce cas les trois pays s'affichent l'un sous
 * l'autre, chacun sous son titre. Une page d'accueil qui ne dirait rien tant
 * qu'un script n'a pas tourné serait un mauvais échange.
 *
 * ─── Ce qui est mémorisé ──────────────────────────────────────────────────
 *
 * Le slug du pays, dans `localStorage`, et rien d'autre. Pas la position,
 * pas d'identifiant, pas d'horodatage. La valeur est déclarée dans
 * `src/data/legal.ts` et la page de confidentialité la liste : un test
 * refuse toute écriture non déclarée.
 */

export const CLE_PAYS = 'luna-marea:pays';

export interface OptionPays {
  slug: string;
  nom: string;
  /** Combien de spots au catalogue dans ce pays. */
  spots: number;
  /** Meilleur score en cours dans ce pays, `null` si aucun n'est calculable. */
  meilleur: number | null;
  /** Le spot qui porte ce score. */
  meilleurSpot: string | null;
  /** Les façades ou régions, telles qu'on les nomme. */
  regions: string;
  points: PointCarte[];
}

function lireChoix(): string | null {
  try {
    return localStorage.getItem(CLE_PAYS);
  } catch {
    // Navigation privée, stockage bloqué : on retombe sur « tous les pays »,
    // qui est un état parfaitement utilisable. Rien à signaler à l'usager.
    return null;
  }
}

export function ChoixPays({ options }: { options: readonly OptionPays[] }) {
  const [choix, setChoix] = useState<string | null>(null);
  const [hydrate, setHydrate] = useState(false);

  useEffect(() => {
    setChoix(lireChoix());
    setHydrate(true);
  }, []);

  useEffect(() => {
    if (!hydrate) return;
    for (const bloc of document.querySelectorAll<HTMLElement>('[data-pays]')) {
      bloc.hidden = choix !== null && bloc.dataset['pays'] !== choix;
    }
    /*
      Les titres de pays n'ont d'utilité que lorsque plusieurs pays sont
      affichés côte à côte. Une fois le choix fait, « France » répété
      au-dessus de chaque bloc est du bruit — le choix est déjà visible dans
      le sélecteur, en haut.
    */
    for (const titre of document.querySelectorAll<HTMLElement>('[data-titre-pays]')) {
      titre.hidden = choix !== null;
    }
  }, [choix, hydrate]);

  function choisir(slug: string): void {
    const suivant = choix === slug ? null : slug;
    setChoix(suivant);
    try {
      if (suivant === null) localStorage.removeItem(CLE_PAYS);
      else localStorage.setItem(CLE_PAYS, suivant);
    } catch {
      // Le choix vaut pour cette visite, il ne survivra pas au rechargement.
      // C'est une dégradation acceptable ; échouer bruyamment ne l'est pas.
    }
  }

  return (
    <div>
      <ul className="grid gap-3 sm:grid-cols-3">
        {options.map((pays) => {
          const actif = choix === pays.slug;
          return (
            <li key={pays.slug}>
              <button
                type="button"
                onClick={() => choisir(pays.slug)}
                aria-pressed={actif}
                className={`flex min-h-tap w-full items-center gap-3 rounded-card border p-3 text-left transition-colors ${
                  actif
                    ? 'border-edge-strong bg-surface-2'
                    : 'border-edge bg-card hover:border-edge-strong'
                }`}
              >
                <span className="h-20 w-20 shrink-0 rounded-inner bg-surface-2 p-1">
                  <MiniCarte points={pays.points} label={`Les spots ${pays.nom}`} />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block text-body font-semibold font-600 text-fg">{pays.nom}</span>
                  <span className="mt-0.5 block truncate text-meta nums text-fg-faint" data-numeric="">
                    {pays.spots} spots · {pays.regions}
                  </span>
                  <span className="mt-0.5 block truncate text-meta nums text-fg-muted" data-numeric="">
                    {/*
                      La virgule décimale, comme partout ailleurs sur le site :
                      `toFixed(1)` rend « 9.1 », un point anglais au milieu
                      d'une page française. `formatScore` est le seul endroit
                      où cette règle est écrite.
                    */}
                    {pays.meilleur === null || pays.meilleurSpot === null
                      ? 'Score indisponible'
                      : `Meilleur maintenant : ${formatScore(pays.meilleur)}/10 à ${pays.meilleurSpot}`}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {/*
        Le bouton de retour n'apparaît qu'une fois un choix fait, et seulement
        après hydratation : rendu côté serveur, il proposerait d'annuler un
        choix qui n'existe pas encore.
      */}
      {hydrate && choix !== null && (
        <p className="mt-3 text-meta nums text-fg-faint" data-numeric="">
          <button
            type="button"
            onClick={() => choisir(choix)}
            className="min-h-[44px] text-fg underline decoration-dotted underline-offset-4"
          >
            Afficher les trois pays
          </button>
        </p>
      )}
    </div>
  );
}
