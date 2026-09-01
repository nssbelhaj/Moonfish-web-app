import type { ReactNode } from 'react';

/** Étiquette d'attribut : puce remplie, jamais bordée, jamais en capitales. */
export function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-tag bg-card-raised px-2.5 py-1 meta font-mono">
      {children}
    </span>
  );
}
