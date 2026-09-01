'use client';

// "use client" justifié : indiquer la page courante exige de connaître le
// chemin, et un layout racine ne le reçoit pas côté serveur. C'est une exigence
// d'accessibilité — sans elle, rien ne dit à l'utilisateur où il se trouve.

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={isActive ? 'page' : undefined}
      className={`pressable inline-flex min-h-[48px] items-center rounded-input px-3 text-body ${
        isActive ? 'bg-card-raised font-600 text-fg' : 'text-fg-muted hover:text-fg'
      }`}
    >
      {children}
    </Link>
  );
}
