import type { Config } from 'tailwindcss';

/**
 * Palette Moonfish v2.
 *
 * Deux familles de tokens cohabitent volontairement :
 *
 * 1. Les littéraux, référence stable, jamais utilisés directement par un composant.
 * 2. Les tokens SÉMANTIQUES (`page`, `card`, `fg`, `score-best`…) adossés à des
 *    variables CSS définies dans globals.css. Ce sont eux que les composants
 *    utilisent, afin qu'un même composant rende juste en sombre comme en clair.
 *
 * Les noms sémantiques n'ont pas changé depuis la v1 : le passage d'une
 * direction artistique verte à une direction neutre n'a donc touché que ce
 * fichier et globals.css, pas une seule ligne de composant.
 *
 * Tous les couples encre/surface sont vérifiés ≥ 4,5:1 par
 * `src/lib/__tests__/contrast.test.ts`. Modifier une valeur ici sans faire
 * passer ce test casse le build.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // ── Littéraux, thème sombre (défaut) ──────────────────────────────
        // Jamais de noir pur : un #000 écrase les surfaces et durcit le rendu.
        ink0: '#0A0B0D',
        ink1: '#15181C',
        ink2: '#1D2126',
        ink3: '#262A30',
        ink4: '#3A3F47',
        chalk: '#F1F3F5',
        'chalk-muted': '#A7AEB8',
        'chalk-dim': '#828A95',

        // ── Littéraux, thème clair ────────────────────────────────────────
        paper: '#FBFAF8',
        'paper-surface': '#F3F1ED',
        'paper-sunk': '#E9E6DF',
        graphite: '#14161A',
        'graphite-muted': '#4A5058',
        'graphite-dim': '#5A6069',

        // ── Paliers de score : désaturés par rapport à la v1 ──────────────
        // Ils portent une DONNÉE, pas une décoration : leur seule contrainte
        // est de rester distinguables entre eux et lisibles sur les trois fonds.
        score: {
          bad: { DEFAULT: 'var(--score-bad)', dark: '#F26A62', light: '#C22B1E' },
          mid: { DEFAULT: 'var(--score-mid)', dark: '#E6A63C', light: '#8A5A00' },
          good: { DEFAULT: 'var(--score-good)', dark: '#5BB8DC', light: '#12579E' },
          best: { DEFAULT: 'var(--score-best)', dark: '#3DD9A0', light: '#1B6B3A' },
        },

        // ── Sémantiques : bascule sombre/clair via variables CSS ──────────
        page: 'var(--page)',
        card: 'var(--card)',
        'card-raised': 'var(--card-raised)',
        edge: 'var(--edge)',
        'edge-strong': 'var(--edge-strong)',
        fg: 'var(--fg)',
        'fg-muted': 'var(--fg-muted)',
        'fg-dim': 'var(--fg-dim)',
        accent: 'var(--score-best)',
        night: 'var(--night)',
        'best-bg': 'var(--best-bg)',
        'alert-bg': 'var(--alert-bg)',
        'alert-ink': 'var(--alert-ink)',
        'alert-line': 'var(--alert-line)',
        'vigil-bg': 'var(--vigil-bg)',
        'vigil-ink': 'var(--vigil-ink)',
        'ok-bg': 'var(--ok-bg)',
        'ok-line': 'var(--ok-line)',
      },
      fontFamily: {
        sans: ['var(--font-archivo)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-plex-mono)', 'ui-monospace', 'monospace'],
        serif: ['var(--font-spectral)', 'Georgia', 'serif'],
      },
      fontSize: {
        // Échelle resserrée : les titres gagnent en présence par le poids et le
        // tracking négatif, pas par la taille brute.
        'score-xl': ['4.25rem', { lineHeight: '0.88', letterSpacing: '-0.045em' }],
        'score-lg': ['3rem', { lineHeight: '0.9', letterSpacing: '-0.04em' }],
        'score-md': ['1.5rem', { lineHeight: '1', letterSpacing: '-0.03em' }],
        display: ['2.75rem', { lineHeight: '1.02', letterSpacing: '-0.035em' }],
        h1: ['1.875rem', { lineHeight: '1.12', letterSpacing: '-0.028em' }],
        h2: ['1.375rem', { lineHeight: '1.25', letterSpacing: '-0.018em' }],
        h3: ['1.0625rem', { lineHeight: '1.35', letterSpacing: '-0.008em' }],
        body: ['1rem', { lineHeight: '1.6' }],
        data: ['0.9375rem', { lineHeight: '1.45' }],
        label: ['0.8125rem', { lineHeight: '1.2', letterSpacing: '0.02em' }],
        'guide-body': ['1.1875rem', { lineHeight: '1.75' }],
      },
      spacing: {
        gutter: '1rem',
        'gutter-lg': '1.5rem',
      },
      borderRadius: {
        tag: '4px',
        input: '8px',
        card: '14px',
        sheet: '18px',
        frame: '24px',
      },
      borderWidth: { DEFAULT: '1px', '2': '2px' },
      maxWidth: { measure: '65ch', shell: '1320px' },
      screens: { xs: '390px' },
      transitionTimingFunction: {
        // Sortie douce : les interfaces de données ne rebondissent pas.
        ui: 'cubic-bezier(0.22, 0.61, 0.36, 1)',
      },
      zIndex: { banner: '30', overlay: '40', skip: '50' },
    },
  },
  plugins: [],
};

export default config;
