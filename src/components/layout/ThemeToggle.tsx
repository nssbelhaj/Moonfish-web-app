'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { THEME_STORAGE_KEY, type Theme } from '@/lib/theme';

const OPTIONS: { value: Theme; label: string; glyph: string }[] = [
  { value: 'clair', label: 'Clair', glyph: '☀' },
  { value: 'nuit', label: 'Nuit', glyph: '☾' },
];

/**
 * Bascule clair / nuit (D18, D19).
 *
 * Deux segments, libellé TOUJOURS visible : jamais une icône seule. Un soleil
 * ou une lune sans mot ne dit pas si l'on montre l'état courant ou l'action à
 * déclencher — l'ambiguïté classique de ce contrôle.
 *
 * Aucune transition (D19) : un fondu de 300 ms vers le clair, de nuit, sur une
 * plage, aveugle. La bascule est instantanée, et c'est délibéré.
 *
 * Absente des pages Guides (D16) : l'éditorial reste en clair, c'est du contenu
 * de lecture diurne et indexable.
 */
export function ThemeToggle() {
  const pathname = usePathname();
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'clair' || stored === 'nuit') {
      setTheme(stored);
      return;
    }
    setTheme(window.matchMedia('(prefers-color-scheme: dark)').matches ? 'nuit' : 'clair');
  }, []);

  if (pathname.startsWith('/guides')) return null;

  function choose(next: Theme) {
    setTheme(next);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Navigation privée, stockage refusé : la bascule vaut pour la session.
    }
    const root = document.documentElement;
    if (next === 'nuit') root.setAttribute('data-theme', 'night');
    else root.removeAttribute('data-theme');
  }

  return (
    <div
      role="group"
      aria-label="Thème d’affichage"
      className="inline-flex h-tap items-center gap-1 rounded-[24px] bg-card p-1"
      style={{ boxShadow: '0 0 0 1px var(--edge)' }}
    >
      {OPTIONS.map((option) => {
        // Avant l'hydratation, `theme` est nul : aucun segment n'est marqué
        // actif plutôt que d'en désigner un au hasard, qui clignoterait.
        const active = theme === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => choose(option.value)}
            aria-pressed={active}
            className={`flex h-10 items-center gap-2 rounded-[20px] px-[14px] text-body ${
              active ? 'font-semibold' : 'text-fg-muted'
            }`}
            style={
              active
                ? { backgroundColor: 'var(--fg)', color: 'var(--page)' }
                : undefined
            }
          >
            <span className="font-serif" aria-hidden="true">
              {option.glyph}
            </span>
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
