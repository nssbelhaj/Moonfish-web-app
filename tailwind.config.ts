import type { Config } from 'tailwindcss';

/**
 * Handoff design v2.
 *
 * Ce fichier ne connaît QUE des noms sémantiques adossés à `var(--…)`. Les
 * littéraux vivent dans `src/app/tokens.css`, qui les réaffecte pour
 * `[data-theme="guide"]`. Un composant écrivant `bg-card text-fg-muted`
 * fonctionne dans les deux thèmes sans condition.
 *
 * Règle D22 : aucun composant ne contient de couleur littérale. Vérifiée par
 * `src/lib/__tests__/color-literals.test.ts`, qui fait échouer le build.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        page: 'var(--page)',
        card: 'var(--card)',
        'card-2': 'var(--card-2)',
        chip: 'var(--chip)',
        edge: 'var(--edge)',
        'edge-strong': 'var(--edge-strong)',
        fg: 'var(--fg)',
        'fg-muted': 'var(--fg-muted)',
        'fg-faint': 'var(--fg-faint)',
        'fg-on-accent': 'var(--fg-on-accent)',
        'accent-score': 'var(--accent-score)',
        'accent-data': 'var(--accent-data)',
        danger: 'var(--danger)',
        warn: 'var(--warn)',
        score: {
          1: 'var(--score-1)',
          2: 'var(--score-2)',
          3: 'var(--score-3)',
          4: 'var(--score-4)',
        },
      },
      fontFamily: {
        sans: ['var(--font-archivo)', 'Archivo', 'system-ui', 'sans-serif'],
        serif: ['var(--font-spectral)', 'Spectral', 'Georgia', 'serif'],
      },
      fontSize: {
        score: ['72px', { lineHeight: '0.92', letterSpacing: '-0.03em', fontWeight: '700' }],
        'score-sm': ['40px', { lineHeight: '0.95', letterSpacing: '-0.02em', fontWeight: '700' }],
        val: ['26px', { lineHeight: '1.1', letterSpacing: '-0.01em', fontWeight: '600' }],
        'val-sm': ['19px', { lineHeight: '1.2', fontWeight: '600' }],
        body: ['15px', { lineHeight: '1.55' }],
        meta: ['13px', { lineHeight: '1.45' }],
        label: ['11px', { lineHeight: '1.3', letterSpacing: '0.1em' }],
      },
      spacing: { tap: '48px', 'tap-lg': '56px' },
      borderRadius: { card: '12px', inner: '10px', ctl: '8px' },
      maxWidth: { shell: '1120px', prose: '68ch' },
      screens: { sm: '480px', md: '768px', lg: '1024px', xl: '1280px' },
    },
  },
  plugins: [],
};

export default config;
