import type { ReactNode } from 'react';

/**
 * Surface surélevée.
 *
 * L'élévation se joue au REMPLISSAGE, jamais au liseré ni à l'ombre : une carte
 * cumulant fond, bordure et ombre est la signature générique par excellence. Le
 * liseré ne réapparaît que lorsqu'il porte un sens — ici l'état actif.
 */
export function Card({
  children,
  className = '',
  active = false,
  interactive = false,
}: {
  children: ReactNode;
  className?: string;
  /** Carte sélectionnée : seul cas où un liseré est légitime. */
  active?: boolean;
  /** Carte cliquable : réagit au survol et à l'appui. */
  interactive?: boolean;
}) {
  return (
    <div
      className={`surface ${active ? 'ring-2 ring-accent-score' : ''} ${
        interactive ? 'pressable hover:bg-surface-2' : ''
      } ${className}`}
    >
      {children}
    </div>
  );
}
