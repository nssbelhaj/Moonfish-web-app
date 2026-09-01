import Link from 'next/link';

export type SpotTab = 'live' | 'prevision' | 'analyse';

const TABS: { id: SpotTab; label: string; segment: string; hint: string }[] = [
  { id: 'live', label: 'Live', segment: '', hint: 'Score et conditions du moment' },
  { id: 'prevision', label: 'Prévision', segment: '/prevision', hint: 'Les 7 prochains jours' },
  { id: 'analyse', label: 'Analyse', segment: '/analyse', hint: 'Le détail du calcul et le spot' },
];

/**
 * Navigation entre les onglets d'un spot.
 *
 * Ce sont de vraies routes, pas des panneaux commutés côté client : chaque
 * onglet a son URL, ses métadonnées et son rendu serveur. Il est donc
 * partageable, indexable, et fonctionne sans JavaScript — ce qu'un `tablist`
 * ARIA à état client ne permettrait pas.
 *
 * D'où le balisage : un `<nav>` de liens avec `aria-current`, et non le motif
 * ARIA « onglets », qui décrirait à tort une navigation comme un composant.
 */
export function SpotTabs({ basePath, active }: { basePath: string; active: SpotTab }) {
  return (
    <nav aria-label="Sections du spot" className="border-b border-edge">
      <ul className="-mb-px flex gap-[22px] overflow-x-auto">
        {TABS.map((tab) => {
          const isActive = tab.id === active;
          return (
            <li key={tab.id}>
              <Link
                href={`${basePath}${tab.segment}`}
                aria-current={isActive ? 'page' : undefined}
                className={`inline-flex min-h-[48px] items-center whitespace-nowrap px-0 text-body tappable ${
                  isActive ? 'font-semibold text-fg' : 'text-fg-muted hover:text-fg'
                }`}
                style={isActive ? { boxShadow: 'inset 0 -2px 0 var(--accent)' } : undefined}
              >
                {tab.label}
                <span className="sr-only"> — {tab.hint}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
