'use client';

// "use client" justifié : la soumission automatique du formulaire au changement
// d'un select demande du JS. Le formulaire reste un <form method="GET"> complet
// avec bouton de soumission visible, donc il fonctionne SANS JavaScript — le JS
// ne fait qu'éviter un clic. L'état n'est jamais dupliqué côté client : la
// vérité est l'URL.

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef } from 'react';
import type { SpotFilters as Filters } from '@/lib/spot-filters';

export interface FilterOption {
  value: string;
  label: string;
  count: number;
}

export interface SpotFiltersProps {
  filters: Filters;
  countries: FilterOption[];
  regions: FilterOption[];
  types: FilterOption[];
  bottoms: FilterOption[];
  techniques: FilterOption[];
  total: number;
}

const FIELDS = [
  { name: 'technique', label: 'Technique', key: 'techniques' },
  { name: 'pays', label: 'Pays', key: 'countries' },
  { name: 'region', label: 'Région', key: 'regions' },
  { name: 'type', label: 'Type de spot', key: 'types' },
  { name: 'fond', label: 'Type de fond', key: 'bottoms' },
] as const;

export function SpotFilters(props: SpotFiltersProps) {
  const { filters, total } = props;
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);

  const current: Record<string, string | null> = {
    technique: filters.technique,
    pays: filters.country,
    region: filters.region,
    type: filters.type,
    fond: filters.bottom,
  };

  const options: Record<string, FilterOption[]> = {
    countries: props.countries,
    regions: props.regions,
    types: props.types,
    bottoms: props.bottoms,
    techniques: props.techniques,
  };

  function submitNow(): void {
    const form = formRef.current;
    if (!form) return;
    const data = new FormData(form);
    const params = new URLSearchParams();
    for (const [key, value] of data.entries()) {
      if (typeof value === 'string' && value.length > 0) params.set(key, value);
    }
    const query = params.toString();
    router.push(query ? `/spots?${query}` : '/spots');
  }

  return (
    <form ref={formRef} method="GET" action="/spots" className="surface p-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {FIELDS.map((field) => (
          <div key={field.name}>
            <label
              htmlFor={`filter-${field.name}`}
              className="block meta font-mono"
            >
              {field.label}
            </label>
            <select
              id={`filter-${field.name}`}
              name={field.name}
              defaultValue={current[field.name] ?? ''}
              onChange={submitNow}
              className="mt-2 min-h-[48px] w-full rounded-input border border-edge-strong bg-card-raised px-3 text-body text-fg"
            >
              <option value="">Tous</option>
              {options[field.key]?.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label} ({option.count})
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          className="inline-flex min-h-[48px] items-center rounded-input border border-edge-strong px-4 font-600"
        >
          Filtrer
        </button>
        <Link
          href="/spots"
          className="inline-flex min-h-[48px] items-center px-2 font-mono text-data text-fg-muted underline decoration-dotted underline-offset-4"
        >
          Tout afficher
        </Link>
        <p className="font-mono text-data text-fg-muted" data-numeric="" aria-live="polite">
          {total} spot{total > 1 ? 's' : ''}
        </p>
      </div>
    </form>
  );
}
