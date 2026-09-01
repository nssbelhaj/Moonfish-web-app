'use client';

// "use client" justifié : indiquer la page courante exige de connaître le
// chemin, et un layout racine ne le reçoit pas côté serveur. C'est une exigence
// d'accessibilité — sans elle, rien ne dit à l'utilisateur où il se trouve.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

export function NavLink({
  href,
  children,
  block = false,
}: {
  href: string;
  children: ReactNode;
  /** Variante pleine largeur pour la barre basse mobile. */
  block?: boolean;
}) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(`${href}/`);

  // Deux canaux pour l'état actif — fond ET liseré — jamais la couleur seule.
  return (
    <Link
      href={href}
      aria-current={isActive ? 'page' : undefined}
      className={`tappable inline-flex items-center justify-center text-body ${
        block
          ? 'h-tap-lg w-full border-t-2'
          : 'min-h-tap rounded-ctl border-b-2 px-3'
      } ${
        isActive
          ? 'border-accent bg-surface-2 font-semibold text-fg'
          : 'border-transparent text-fg-muted hover:bg-surface-2 hover:text-fg'
      }`}
    >
      {children}
    </Link>
  );
}
