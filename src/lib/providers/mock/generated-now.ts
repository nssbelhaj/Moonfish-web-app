/**
 * Instant de génération d'une donnée simulée, arrondi à l'heure.
 *
 * Les mocks fabriquent leurs données au moment du rendu : leur date de
 * « relevé » est donc l'instant courant, pas le début de la plage demandée.
 * L'arrondi à l'heure reprend exactement la règle de `referenceNow()`, sans
 * quoi deux builds lancés dans la même heure cesseraient d'être identiques.
 */
export function generatedNow(): string {
  return new Date(Math.floor(Date.now() / 3_600_000) * 3_600_000).toISOString();
}
