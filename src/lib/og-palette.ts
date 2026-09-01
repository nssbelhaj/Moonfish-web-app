/**
 * Palette littérale pour l'image Open Graph — handoff v3, thème CLAIR.
 *
 * SEULE exception à la règle D22, et elle est contrainte : l'image est rendue
 * par Satori hors du DOM, sans cascade CSS ni variables. Elle ne peut donc pas
 * lire `tokens.css`.
 *
 * Pour que l'exception ne devienne pas une dérive, `og-palette.test.ts` vérifie
 * que chaque valeur ci-dessous est identique au littéral correspondant dans
 * `tokens.css`. Un changement de thème qui oublierait ce fichier casse le build.
 *
 * Le thème clair est retenu parce qu'une vignette de partage est vue en dehors
 * de l'application, souvent sur fond blanc : le sombre y découpait un rectangle
 * noir dans le fil.
 */
export const OG_PALETTE = {
  page: '#f7f4ed',
  card: '#fbfaf6',
  edge: '#c9b992',
  fg: '#123b4c',
  fgMuted: '#4f656f',
  accent: '#276980',
  score1: '#5f5749',
  score2: '#9f6100',
  score3: '#276980',
  score4: '#3b7e37',
} as const;

/** Nom du littéral correspondant dans tokens.css, pour le test de synchronisation. */
export const OG_PALETTE_SOURCE: Record<keyof typeof OG_PALETTE, string> = {
  page: 'nacre-100',
  card: 'nacre-050',
  edge: 'sable-400',
  fg: 'encre-900',
  fgMuted: 'encre-500',
  accent: 'sonde-700',
  score1: 'score-1-l',
  score2: 'score-2-l',
  score3: 'sonde-700',
  score4: 'score-4-l',
};
