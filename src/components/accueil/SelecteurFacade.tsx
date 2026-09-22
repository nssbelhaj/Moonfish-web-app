'use client';

import { useEffect, useState } from 'react';

import { appliquerFacade, ecrireFacade, FACADE_PAR_DEFAUT, lireFacade } from '@/lib/facade';

export interface OptionFacade {
  slug: string;
  nom: string;
}

/**
 * Le sélecteur de façade, en tête du direct.
 *
 * Trois segments — France, Maroc, Espagne. Choisir l'un d'eux bascule TOUT
 * ce que la page montre en direct : le meilleur spot, sa marée, sa semaine,
 * ce soir et demain matin. Le choix est retenu pour la prochaine visite.
 *
 * Le serveur rend déjà la façade par défaut, masquant les autres : sans
 * script, la page est cohérente ; avec, elle devient celle qu'on a choisie.
 */
export function SelecteurFacade({ options }: { options: readonly OptionFacade[] }) {
  const [facade, setFacade] = useState<string>(FACADE_PAR_DEFAUT);
  const [hydrate, setHydrate] = useState(false);

  useEffect(() => {
    setFacade(lireFacade() ?? FACADE_PAR_DEFAUT);
    setHydrate(true);
  }, []);

  useEffect(() => {
    if (hydrate) appliquerFacade(facade);
  }, [facade, hydrate]);

  function choisir(slug: string): void {
    setFacade(slug);
    ecrireFacade(slug);
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <span className="text-meta text-fg-muted" id="facade-libelle">
        Façade
      </span>
      <div
        role="group"
        aria-labelledby="facade-libelle"
        className="inline-flex rounded-pill bg-surface-2 p-[3px]"
      >
        {options.map((option) => {
          const actif = option.slug === facade;
          return (
            <button
              key={option.slug}
              type="button"
              onClick={() => choisir(option.slug)}
              aria-pressed={actif}
              className={`tappable min-h-[40px] rounded-pill px-4 text-body ${
                actif ? 'bg-card font-600 text-fg' : 'text-fg-muted hover:text-fg'
              }`}
              style={actif ? { boxShadow: 'var(--ombre-controle)' } : undefined}
            >
              {option.nom}
            </button>
          );
        })}
      </div>
    </div>
  );
}
