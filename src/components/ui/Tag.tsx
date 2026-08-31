import type { ReactNode } from 'react';

/** Étiquette d'attribut : mono, majuscules, radius 2. */
export function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-tag border border-edge px-2 py-1 font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-fg-muted">
      {children}
    </span>
  );
}
