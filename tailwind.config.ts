import type { Config } from 'tailwindcss';

/**
 * Traduction directe du HANDOFF DESIGN v1.
 *
 * Deux familles de tokens cohabitent volontairement :
 *
 * 1. Les littéraux du handoff (`abyss`, `paper`, `line`, `score-bad-dark`…).
 *    Ils sont la référence : ils ne bougent pas et servent à écrire les variables CSS.
 * 2. Les tokens sémantiques (`page`, `card`, `fg`, `score-bad`…) adossés à des
 *    variables CSS définies dans globals.css. Ce sont EUX que les composants
 *    utilisent, afin qu'un même composant rende juste en sombre (défaut) comme en
 *    clair (jour + guides) sans une seule classe conditionnelle.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // --- Littéraux sombre ---
        abyss: '#05100F',
        surface: '#0A1A19',
        raised: '#102624',
        line: '#1E3439',
        'line-strong': '#2C4A4C',
        ink: '#E8F2F0',
        muted: '#9FB4B3',
        dim: '#7E9494',
        // --- Littéraux clair ---
        paper: '#FBF8F1',
        'paper-surface': '#F4EFE4',
        'paper-sunk': '#E7E0CE',
        hairline: '#C9C0AC',
        'ink-dark': '#10201F',
        'ink-2': '#3C4A46',
        'ink-3': '#5C6B66',
        // --- Marque ---
        sonde: '#0B5E80',
        night: '#152B29',
        'danger-bg': '#2A0F0D',
        'danger-ink': '#FFD9D6',
        'warn-bg': '#241A05',
        'warn-ink': '#FFD9A0',
        'best-bg': '#0D2620',
        'best-line': '#1E5C4A',
        score: {
          bad: { DEFAULT: 'var(--score-bad)', dark: '#FF5A52', light: '#B3251C' },
          mid: { DEFAULT: 'var(--score-mid)', dark: '#FFB020', light: '#8A5300' },
          good: { DEFAULT: 'var(--score-good)', dark: '#4FC3E8', light: '#0B5E80' },
          best: { DEFAULT: 'var(--score-best)', dark: '#2FE39A', light: '#04695A' },
        },
        // --- Sémantiques (bascule sombre/clair via variables CSS) ---
        page: 'var(--page)',
        card: 'var(--card)',
        'card-raised': 'var(--card-raised)',
        edge: 'var(--edge)',
        'edge-strong': 'var(--edge-strong)',
        fg: 'var(--fg)',
        'fg-muted': 'var(--fg-muted)',
        'fg-dim': 'var(--fg-dim)',
        accent: 'var(--score-best)',
        'alert-bg': 'var(--alert-bg)',
        'alert-ink': 'var(--alert-ink)',
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
        // [taille, { lineHeight, letterSpacing }]
        'score-xl': ['4.5rem', { lineHeight: '0.9', letterSpacing: '-0.04em' }],
        'score-lg': ['3.25rem', { lineHeight: '0.92', letterSpacing: '-0.045em' }],
        'score-md': ['1.6rem', { lineHeight: '1', letterSpacing: '-0.03em' }],
        display: ['3.5rem', { lineHeight: '1', letterSpacing: '-0.03em' }],
        h1: ['2rem', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
        h2: ['1.5rem', { lineHeight: '1.2', letterSpacing: '-0.015em' }],
        h3: ['1.0625rem', { lineHeight: '1.3' }],
        body: ['1rem', { lineHeight: '1.55' }],
        data: ['0.9375rem', { lineHeight: '1.45' }],
        label: ['0.75rem', { lineHeight: '1', letterSpacing: '0.14em' }],
        'guide-body': ['1.1875rem', { lineHeight: '1.7' }],
      },
      spacing: {
        // Base 4. Les pas hors échelle sont volontairement absents.
        gutter: '1rem',
        'gutter-lg': '1.5rem',
        screenx: '1rem',
        'screenx-lg': '2rem',
      },
      borderRadius: {
        tag: '2px',
        input: '6px',
        card: '10px',
        sheet: '16px',
        frame: '22px',
      },
      borderWidth: { DEFAULT: '1px', '2': '2px' },
      boxShadow: {
        'elev-1': '0 1px 0 #1E3439',
        'elev-2': '0 8px 24px rgba(0,0,0,.55)',
        'elev-light': '0 1px 2px rgba(16,32,31,.10)',
      },
      maxWidth: { measure: '68ch', shell: '1440px' },
      screens: { xs: '390px' },
    },
  },
  plugins: [],
};

export default config;
