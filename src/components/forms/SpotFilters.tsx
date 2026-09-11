'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import {
  EMPTY_FILTERS,
  correspond,
  filtersToSearchParams,
  hasAnyFilter,
  optionsFacette,
  type FacetteSpot,
  type FiltreCle,
  type OptionFacette,
  type SpotFilters as Filters,
} from '@/lib/spot-filters';

/**
 * Filtres de la page /spots.
 *
 * ─── Instantanés, sans rechargement, et l'URL reste la vérité ────────────
 *
 * La première version soumettait un formulaire GET à chaque changement : la
 * page entière repartait au serveur, et les listes d'options comptaient
 * toujours TOUT le catalogue — choisir « Maroc » laissait « Bretagne » sous
 * Région, avec ses dix spots qu'on ne verrait jamais.
 *
 * Ici, la page rend TOUTES les cartes au serveur, chacune portant son slug en
 * `data-spot`. Filtrer, c'est masquer : aucune requête, et les cartes gardent
 * leurs scores calculés au serveur. Les options se recomptent contre les
 * AUTRES filtres actifs — c'est la définition d'une recherche à facettes —
 * et une option qui ne donnerait plus rien reste visible mais grisée, pour ne
 * pas faire sauter la liste.
 *
 * L'adresse suit chaque changement : elle est partageable, et la même URL
 * rechargée donne la même liste, rendue au serveur, avant tout script.
 * Sans JavaScript, le formulaire reste un GET complet avec son bouton.
 */

export interface Libelles {
  type: Record<string, string>;
  fond: Record<string, string>;
  technique: Record<string, string>;
}

const CHAMPS: { cle: FiltreCle; nom: string; libelle: string }[] = [
  { cle: 'technique', nom: 'technique', libelle: 'Technique' },
  { cle: 'region', nom: 'region', libelle: 'Région' },
  { cle: 'type', nom: 'type', libelle: 'Type de spot' },
  { cle: 'bottom', nom: 'fond', libelle: 'Type de fond' },
];

export function SpotFilters({
  initial,
  spots,
  libelles,
}: {
  initial: Filters;
  spots: readonly FacetteSpot[];
  libelles: Libelles;
}) {
  const [f, setF] = useState<Filters>(initial);
  const [hydrate, setHydrate] = useState(false);
  useEffect(() => setHydrate(true), []);

  const visibles = useMemo(
    () => new Set(spots.filter((s) => correspond(s, f)).map((s) => s.slug)),
    [spots, f],
  );

  /*
    La liste est rendue au serveur ; le filtre la MASQUE. On touche au DOM
    plutôt que de rapatrier les cartes côté client : elles portent des scores
    calculés au serveur, et les recalculer ici doublerait le code de prévision.
  */
  useEffect(() => {
    if (!hydrate) return;
    for (const carte of document.querySelectorAll<HTMLElement>('[data-spot]')) {
      carte.hidden = !visibles.has(carte.dataset['spot'] ?? '');
    }
    for (const el of document.querySelectorAll<HTMLElement>('[data-compteur]')) {
      el.textContent = String(visibles.size);
    }
    for (const el of document.querySelectorAll<HTMLElement>('[data-vide]')) el.hidden = visibles.size > 0;
    for (const el of document.querySelectorAll<HTMLElement>('[data-liste]')) el.hidden = visibles.size === 0;

    const query = filtersToSearchParams(f).toString();
    const url = query ? `/spots?${query}` : '/spots';
    if (`${location.pathname}${location.search}` !== url) history.replaceState(null, '', url);
  }, [visibles, f, hydrate]);

  const facettes: Record<FiltreCle, OptionFacette[]> = {
    country: optionsFacette(spots, f, 'country', (s) => [[s.pays, s.paysNom]]),
    technique: optionsFacette(spots, f, 'technique', (s) =>
      s.techniques.map((t) => [t, libelles.technique[t] ?? t] as const),
    ),
    region: optionsFacette(spots, f, 'region', (s) => [[s.region, s.regionNom]]),
    type: optionsFacette(spots, f, 'type', (s) => [[s.type, libelles.type[s.type] ?? s.type]]),
    bottom: optionsFacette(spots, f, 'bottom', (s) => [[s.fond, libelles.fond[s.fond] ?? s.fond]]),
  };

  const libelleDe = (cle: FiltreCle, value: string): string =>
    facettes[cle].find((o) => o.value === value)?.label ?? value;

  const actifs = (Object.keys(f) as FiltreCle[]).filter((cle) => f[cle] !== null);

  function poser(cle: FiltreCle, value: string | null): void {
    setF((prev) => {
      const next: Filters = { ...prev, [cle]: value === '' ? null : value };
      // Une région appartient à un pays : changer de pays retire une région
      // qui n'en fait plus partie, plutôt que de laisser une liste vide.
      if (cle === 'country' && next.region !== null) {
        const region = next.region;
        const encore = spots.some((s) => s.region === region && (next.country === null || s.pays === next.country));
        if (!encore) next.region = null;
      }
      return next;
    });
  }

  return (
    <form method="GET" action="/spots" className="filtres" aria-label="Filtrer les spots">
      {/* ── Pays : la facette de tête, en boutons ──────────────────────── */}
      <div className="filtres-pays" role="group" aria-label="Pays">
        <button
          type="button"
          className="filtre-pilule"
          aria-pressed={f.country === null}
          onClick={() => poser('country', null)}
        >
          Tous les pays
        </button>
        {facettes.country.map((o) => (
          <button
            key={o.value}
            type="button"
            className="filtre-pilule"
            aria-pressed={f.country === o.value}
            disabled={o.count === 0 && f.country !== o.value}
            onClick={() => poser('country', f.country === o.value ? null : o.value)}
          >
            {o.label} <span className="filtre-compte nums">{o.count}</span>
          </button>
        ))}
        {/* Le GET sans script a besoin d'un champ nommé : un select le porte, hors écran. */}
        <select
          name="pays"
          value={f.country ?? ''}
          onChange={(e) => poser('country', e.target.value)}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
        >
          <option value="">Tous</option>
          {facettes.country.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div className="filtres-grille">
        {CHAMPS.map(({ cle, nom, libelle }) => (
          <label key={cle} className="filtre-champ">
            <span className="filtre-libelle">{libelle}</span>
            <select
              name={nom}
              value={f[cle] ?? ''}
              onChange={(e) => poser(cle, e.target.value)}
              className="filtre-select nums"
            >
              <option value="">Tous</option>
              {facettes[cle].map((o) => (
                <option key={o.value} value={o.value} disabled={o.count === 0 && f[cle] !== o.value}>
                  {o.label} ({o.count})
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>

      <div className="filtres-pied">
        <p className="nums text-body text-fg" aria-live="polite">
          <strong className="font-600" data-compteur="">
            {visibles.size}
          </strong>{' '}
          spot{visibles.size > 1 ? 's' : ''}
          {actifs.length > 0 && <span className="text-fg-muted"> sur {spots.length}</span>}
        </p>

        {actifs.length > 0 && (
          <ul className="filtres-actifs" aria-label="Filtres actifs">
            {actifs.map((cle) => (
              <li key={cle}>
                <button type="button" className="filtre-actif" onClick={() => poser(cle, null)}>
                  {libelleDe(cle, f[cle] ?? '')}
                  <span aria-hidden="true"> ×</span>
                  <span className="sr-only"> — retirer ce filtre</span>
                </button>
              </li>
            ))}
            <li>
              <button type="button" className="filtre-tout" onClick={() => setF(EMPTY_FILTERS)}>
                Tout effacer
              </button>
            </li>
          </ul>
        )}

        {/* Sans script : le bouton soumet le GET. Avec : il n'a plus de raison d'être. */}
        {!hydrate && (
          <button type="submit" className="filtre-tout">
            Filtrer
          </button>
        )}
        {!hydrate && hasAnyFilter(initial) && (
          <Link href="/spots" className="filtre-tout">
            Tout afficher
          </Link>
        )}
      </div>
    </form>
  );
}
