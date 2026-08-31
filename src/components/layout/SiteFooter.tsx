import Link from 'next/link';

export function SiteFooter() {
  return (
    <footer className="mt-12 border-t border-edge">
      <div className="mx-auto max-w-shell px-4 py-8 md:px-8">
        <div className="demo-frame px-4 py-3">
          <p className="font-mono text-label uppercase tracking-[0.14em] text-score-mid">
            Données de démonstration
          </p>
          <p className="mt-2 max-w-measure text-body text-fg-muted">
            Marées, vent et houle sont simulés sur l’ensemble du site. Ne les utilisez pas pour
            planifier une sortie réelle. Pour des données officielles : horaires de marée sur{' '}
            <a
              href="https://maree.shom.fr"
              className="underline decoration-dotted underline-offset-4"
              rel="noopener noreferrer"
              target="_blank"
            >
              maree.shom.fr
            </a>{' '}
            et bulletin marine sur{' '}
            <a
              href="https://meteofrance.com/meteo-marine"
              className="underline decoration-dotted underline-offset-4"
              rel="noopener noreferrer"
              target="_blank"
            >
              meteofrance.com
            </a>
            . Le lever et le coucher du Soleil ainsi que la phase de Lune, eux, sont calculés et
            exacts.
          </p>
        </div>

        <nav aria-label="Pied de page" className="mt-6">
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            {[
              { href: '/spots', label: 'Tous les spots' },
              { href: '/guides', label: 'Guides' },
              { href: '/pricing', label: 'Tarifs' },
            ].map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="inline-flex min-h-[44px] items-center text-body text-fg-muted hover:text-fg">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <p className="mt-4 font-mono text-[0.6875rem] text-fg-dim">
          Moonfish — les meilleurs créneaux surfcasting, spot par spot. Aucune promesse de prise :
          la mer décide.
        </p>
      </div>
    </footer>
  );
}
