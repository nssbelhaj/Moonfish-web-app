import type { ReactNode } from 'react';

/**
 * Surface surélevée. En sombre, l'élévation se joue au LISERÉ et non à l'ombre
 * (handoff §1) : d'où la bordure systématique et l'absence de box-shadow.
 */
export function Card({
  children,
  className = '',
  active = false,
}: {
  children: ReactNode;
  className?: string;
  /** Carte active : bordure 2 px, seul cas où la largeur de trait change. */
  active?: boolean;
}) {
  return (
    <div
      className={`rounded-card bg-card ${active ? 'border-2 border-edge-strong' : 'border border-edge'} ${className}`}
    >
      {children}
    </div>
  );
}
