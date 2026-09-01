'use client';

// "use client" justifié : filtrage instantané au clavier sur une liste déjà
// envoyée au client. Aucun aller-retour réseau, donc aucun intérêt à faire
// transiter chaque frappe par le serveur.

import Link from 'next/link';
import { useId, useMemo, useState } from 'react';
import { formatScore, tierFor } from '@/lib/score-display';

export interface SearchableSpot {
  slug: string;
  name: string;
  regionName: string;
  countryName: string;
  href: string;
  score: number | null;
}

/** Normalise pour que « lespiguette » trouve « L'Espiguette ». */
function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase();
}

export function SpotSearch({ spots }: { spots: readonly SearchableSpot[] }) {
  const [query, setQuery] = useState('');
  const inputId = useId();
  const listId = useId();

  const results = useMemo(() => {
    const needle = normalize(query);
    if (needle.length < 2) return [];
    return spots
      .filter(
        (spot) =>
          normalize(spot.name).includes(needle) ||
          normalize(spot.regionName).includes(needle) ||
          normalize(spot.countryName).includes(needle),
      )
      .slice(0, 6);
  }, [query, spots]);

  return (
    <div>
      <label htmlFor={inputId} className="block text-meta text-fg-faint nums">
        Chercher un spot ou une ville
      </label>
      <input
        id={inputId}
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Crozon, Lacanau, Agadir…"
        role="combobox"
        aria-expanded={results.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        className="mt-2 min-h-[56px] w-full rounded-ctl border border-edge-strong bg-chip px-4 text-body text-fg placeholder:text-fg-muted"
      />

      <div aria-live="polite" className="sr-only">
        {query.length >= 2 ? `${results.length} spot(s) trouvé(s)` : ''}
      </div>

      {query.length >= 2 && (
        <ul id={listId} className="mt-3 divide-y divide-edge surface">
          {results.length === 0 && (
            <li className="px-4 py-4 text-body text-fg-muted">
              Aucun spot ne correspond. Les 12 spots du catalogue sont listés sur{' '}
              <Link href="/spots" className="underline decoration-dotted underline-offset-4">
                la page Spots
              </Link>
              .
            </li>
          )}
          {results.map((spot) => {
            const tier = spot.score === null ? null : tierFor(spot.score);
            return (
              <li key={spot.slug}>
                <Link
                  href={spot.href}
                  className="flex min-h-[56px] items-center justify-between gap-3 px-4 py-3"
                >
                  <span>
                    <span className="block font-600">{spot.name}</span>
                    <span className="block text-meta nums text-fg-muted">
                      {spot.regionName} · {spot.countryName}
                    </span>
                  </span>
                  <span
                    className="nums text-val font-600"
                    style={{ color: tier?.colorVar ?? 'var(--fg-dim)' }}
                    data-numeric=""
                  >
                    {formatScore(spot.score)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
