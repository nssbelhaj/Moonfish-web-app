'use client';

import { useEffect, useState } from 'react';

import { ecrireFacade, lireFacade } from '@/lib/facade';

/**
 * « Faire de cette façade mon accueil. »
 *
 * ─── Explicite, jamais déduit ─────────────────────────────────────────────
 *
 * On aurait pu retenir le pays au simple passage sur sa page : c'est ce que
 * font beaucoup de sites, et c'est exactement ce qui surprend — on regarde
 * le Maroc par curiosité, et l'accueil change de pays sans qu'on ait rien
 * demandé. Ici, c'est un bouton, avec l'état lisible dessus, et le contraire
 * au même endroit.
 *
 * L'écriture passe par `@/lib/facade`, le seul fichier qui écrit cette
 * valeur — c'est ce que la page de confidentialité déclare.
 */
export function RetenirPays({ slug, nom }: { slug: string; nom: string }) {
  const [retenu, setRetenu] = useState<boolean | null>(null);

  useEffect(() => {
    setRetenu(lireFacade() === slug);
  }, [slug]);

  function basculer(): void {
    const suivant = !retenu;
    setRetenu(suivant);
    ecrireFacade(suivant ? slug : null);
  }

  // Avant hydratation, on ne sait pas : on ne promet rien.
  if (retenu === null) return null;

  return (
    <button
      type="button"
      onClick={basculer}
      aria-pressed={retenu}
      className={`tappable inline-flex min-h-[48px] items-center gap-2 rounded-ctl border px-4 text-body font-600 ${
        retenu ? 'border-edge-strong bg-surface-2 text-fg' : 'border-edge-strong text-fg hover:bg-surface-2'
      }`}
    >
      <span aria-hidden="true">{retenu ? '✓' : '☆'}</span>
      {retenu ? `${nom} est votre façade d’accueil` : `Faire ${nomAvecDe(nom)} ma façade d’accueil`}
    </button>
  );
}

/** « de la France », « du Maroc », « de l’Espagne ». */
function nomAvecDe(nom: string): string {
  if (/^[AEIOUYÉÈ]/i.test(nom)) return `de l’${nom}`;
  if (nom === 'Maroc') return 'du Maroc';
  return `de la ${nom}`;
}
