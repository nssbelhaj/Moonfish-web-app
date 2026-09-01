import Link from 'next/link';
import { NavLink } from './NavLink';
import { ThemeToggle } from './ThemeToggle';

const NAV = [
  { href: '/spots', label: 'Spots' },
  { href: '/carte', label: 'Carte' },
  { href: '/guides', label: 'Guides' },
  { href: '/donnees', label: 'Données' },
] as const;

/**
 * En-tête. À 375 px il ne porte que la marque : la navigation passe en bas
 * d'écran, à portée de pouce (§05). À partir de 768 px elle remonte ici.
 */
export function SiteHeader() {
  return (
    <header className="relative z-30 bg-page">
      <div className="mx-auto flex max-w-shell items-center justify-between gap-4 px-4 py-3 md:px-6">
        <Link href="/" className="flex min-h-tap items-center gap-2 font-semibold">
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <circle cx="12" cy="12" r="10" fill="none" stroke="var(--accent)" strokeWidth="2" />
            <circle cx="12" cy="12" r="4" fill="var(--accent)" />
          </svg>
          <span className="font-serif text-[19px] font-semibold">Moonfish</span>
        </Link>

        <div className="flex items-center gap-3">
          <nav aria-label="Navigation principale" className="hidden md:block">
            <ul className="flex items-center gap-1">
              {NAV.map((item) => (
                <li key={item.href}>
                  <NavLink href={item.href}>{item.label}</NavLink>
                </li>
              ))}
            </ul>
          </nav>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

/**
 * Navigation basse, mobile uniquement.
 *
 * Hauteur 56 px, cibles pleine largeur : c'est la zone atteignable au pouce sur
 * un téléphone tenu à une main, en bord de mer, avec l'autre main occupée.
 */
export function MobileNav() {
  return (
    <nav
      aria-label="Navigation principale"
      className="fixed inset-x-0 bottom-0 z-30 bg-card md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="mx-auto flex max-w-shell">
        {NAV.map((item) => (
          <li key={item.href} className="flex-1">
            <NavLink href={item.href} block>
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
