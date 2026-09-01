import type { Config } from 'tailwindcss';

/**
 * Handoff design v3.
 *
 * Ce fichier ne connaît QUE des noms sémantiques adossés à `var(--…)`. Les
 * littéraux vivent dans `src/app/tokens.css`, qui les réaffecte pour
 * `[data-theme="night"]`. Un composant écrivant `bg-card text-fg-muted`
 * fonctionne dans les deux thèmes sans condition.
 *
 * Règle D22 : aucun composant ne contient de couleur littérale. Vérifiée par
 * `src/lib/__tests__/color-literals.test.ts`, qui fait échouer le build.
 *
 * NOMS HÉRITÉS DU V2. Ils restent définis le temps de la migration, chacun
 * pointant vers son équivalent v3. Les supprimer d'un coup ferait disparaître
 * les règles CSS correspondantes SANS erreur de compilation : la classe devient
 * un no-op silencieux et le texte hérite de la couleur ambiante. C'est
 * exactement le bug `text-abyss` du v2, invisible pour tsc, ESLint et les tests
 * de tokens — seul Lighthouse l'avait vu, à 1,62:1. La liste des noms hérités
 * encore employés est tenue par `color-classes.test.ts` : quand elle est vide,
 * ce bloc disparaît.
 */
const LEGACY = {
  'card-2': 'var(--surface-2)',
  chip: 'var(--surface-2)',
  'fg-faint': 'var(--fg-muted)',
  'accent-score': 'var(--accent)',
  'accent-data': 'var(--accent)',
} as const;

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        page: 'var(--page)',
        card: 'var(--card)',
        'surface-2': 'var(--surface-2)',
        edge: 'var(--edge)',
        'edge-strong': 'var(--edge-strong)',
        water: 'var(--water)',
        accent: 'var(--accent)',
        fg: 'var(--fg)',
        'fg-muted': 'var(--fg-muted)',
        'fg-on-accent': 'var(--fg-on-accent)',
        danger: 'var(--danger)',
        warn: 'var(--warn)',
        score: {
          1: 'var(--score-1)',
          2: 'var(--score-2)',
          3: 'var(--score-3)',
          4: 'var(--score-4)',
        },
        ...LEGACY,
      },
      fontFamily: {
        sans: ['var(--font-archivo)', 'Archivo', 'system-ui', 'sans-serif'],
        serif: ['var(--font-spectral)', 'Spectral', 'Georgia', 'serif'],
      },
      fontSize: {
        score: ['56px', { lineHeight: '0.95', letterSpacing: '-0.02em', fontWeight: '700' }],
        'score-md': ['34px', { lineHeight: '1', fontWeight: '700' }],
        'score-sm': ['26px', { lineHeight: '1', fontWeight: '700' }],
        h1: ['30px', { lineHeight: '1.12', fontWeight: '600' }],
        h2: ['21px', { lineHeight: '1.15', fontWeight: '600' }],
        h3: ['17px', { lineHeight: '1.25', fontWeight: '600' }],
        body: ['13.5px', { lineHeight: '1.6' }],
        read: ['15.5px', { lineHeight: '1.7' }],
        meta: ['12.5px', { lineHeight: '1.5' }],
        src: ['11px', { lineHeight: '1.45' }],
        // Hérités du v2, alignés sur l'échelle v3 la plus proche.
        val: ['21px', { lineHeight: '1.15', fontWeight: '600' }],
        'val-sm': ['17px', { lineHeight: '1.25', fontWeight: '600' }],
        label: ['11px', { lineHeight: '1.45' }],
      },
      spacing: { tap: '48px', 'tap-lg': '56px' },
      borderRadius: { card: '12px', inner: '9px', pill: '999px', frame: '20px', ctl: '9px' },
      maxWidth: { shell: '1392px', prose: '68ch' },
      screens: { sm: '480px', md: '768px', lg: '1024px', xl: '1280px', '2xl': '1440px' },
    },
  },
  plugins: [],
};

export default config;
