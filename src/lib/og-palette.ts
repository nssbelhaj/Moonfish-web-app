/**
 * Palette littérale pour l'image Open Graph.
 *
 * SEULE exception à la règle D22, et elle est contrainte : l'image est rendue
 * par Satori hors du DOM, sans cascade CSS ni variables. Elle ne peut donc pas
 * lire `tokens.css`.
 *
 * Pour que l'exception ne devienne pas une dérive, `og-palette.test.ts` vérifie
 * que chaque valeur ci-dessous est identique au littéral correspondant dans
 * `tokens.css`. Un changement de thème qui oublierait ce fichier casse le build.
 */
export const OG_PALETTE = {
  page: '#0b0d0f',
  card: '#12151a',
  edge: '#2c333c',
  fg: '#e8ebef',
  fgMuted: '#8b95a1',
  fgFaint: '#7c8695',
  accentScore: '#ffb020',
  score1: '#8b95a1',
  score2: '#ffb020',
  score3: '#4fa8ff',
  score4: '#46e0b0',
} as const;

/** Nom du littéral correspondant dans tokens.css, pour le test de synchronisation. */
export const OG_PALETTE_SOURCE: Record<keyof typeof OG_PALETTE, string> = {
  page: 'ink-950',
  card: 'ink-900',
  edge: 'ink-700',
  fg: 'ink-050',
  fgMuted: 'ink-200',
  fgFaint: 'ink-300',
  accentScore: 'amber-400',
  score1: 'ink-200',
  score2: 'amber-400',
  score3: 'azure-400',
  score4: 'mint-400',
};
