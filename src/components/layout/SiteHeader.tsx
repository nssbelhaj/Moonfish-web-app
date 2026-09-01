import Link from 'next/link';
import { NavLink } from './NavLink';

const NAV = [
  { href: '/spots', label: 'Spots' },
  { href: '/guides', label: 'Guides' },
  { href: '/pricing', label: 'Tarifs' },
] as const;

export function SiteHeader() {
  return (
    <header className="relative z-banner border-b border-edge bg-page">
      <div className="mx-auto flex max-w-shell items-center justify-between gap-4 px-4 py-3 md:px-8">
        <Link href="/" className="flex min-h-[48px] items-center gap-2 font-600">
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <circle cx="12" cy="12" r="10" fill="none" stroke="var(--score-best)" strokeWidth="2" />
            <circle cx="12" cy="12" r="4" fill="var(--score-best)" />
          </svg>
          <span className="text-h3">Moonfish</span>
        </Link>

        <nav aria-label="Navigation principale">
          <ul className="flex items-center gap-1">
            {NAV.map((item) => (
              <li key={item.href}>
                <NavLink href={item.href}>{item.label}</NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
