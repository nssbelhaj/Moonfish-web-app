import Link from 'next/link';
import { ASTRO_SOURCE, tides, weather } from '@/lib/providers';

const KIND_LABEL = {
  measured: 'Relevé',
  forecast: 'Prévision',
  computed: 'Calculé',
  simulated: 'Simulé',
} as const;

const SOURCES = [
  { label: 'Marées', source: tides.source },
  { label: 'Vent et houle', source: weather.source },
  { label: 'Soleil et Lune', source: ASTRO_SOURCE },
] as const;

export function SiteFooter() {
  const anySimulated = SOURCES.some((entry) => entry.source.kind === 'simulated');

  return (
    <footer className="mt-12 border-t border-edge">
      <div className="mx-auto max-w-shell px-4 py-8 md:px-8">
        {/*
          Décrit l'état RÉEL des fournisseurs déclarés plutôt qu'une phrase figée.
          Depuis le branchement d'Open-Meteo, dire « tout est simulé » serait
          devenu faux — et une mention fausse, même prudente, use la confiance
          aussi sûrement qu'une mention absente.
        */}
        <div className={anySimulated ? 'demo-frame px-4 py-3' : 'surface px-4 py-3'}>
          <p className="text-meta text-fg-faint nums">
            D’où viennent les données
          </p>
          <ul className="mt-3 max-w-prose space-y-2">
            {SOURCES.map(({ label, source }) => (
              <li key={label} className="text-body text-fg-muted">
                <span className="text-meta text-fg-faint nums">
                  {KIND_LABEL[source.kind]}
                </span>{' '}
                — <strong className="font-600 text-fg">{label}</strong> : {source.name}.
              </li>
            ))}
          </ul>
          {anySimulated && (
            <p className="mt-3 max-w-prose text-body text-fg-muted">
              Ce qui est marqué <em>simulé</em> est inventé : ne vous en servez pas pour planifier
              une sortie. Horaires officiels sur{' '}
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
              .
            </p>
          )}
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

        <p className="mt-4 text-meta text-fg-faint nums">
          Moonfish — les meilleurs créneaux de pêche en mer, spot par spot. Aucune promesse de prise :
          la mer décide.
        </p>
      </div>
    </footer>
  );
}
