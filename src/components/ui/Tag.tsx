import type { ReactNode } from 'react';

/** Étiquette d'attribut : puce remplie, jamais bordée, jamais en capitales. */
export function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-ctl bg-chip px-2.5 py-1 text-meta text-fg-muted nums">
      {children}
    </span>
  );
}
