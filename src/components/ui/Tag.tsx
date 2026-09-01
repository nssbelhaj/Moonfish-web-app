import type { ReactNode } from 'react';

/** Étiquette d'attribut : puce remplie, jamais bordée, jamais en capitales. */
export function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-ctl bg-surface-2 px-2.5 py-1 text-meta text-fg nums">
      {children}
    </span>
  );
}
