export const CARDINALS = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'] as const;

/**
 * Secteur d'où vient le vent, en abrégé français.
 *
 * « O » pour Ouest, pas « W » : le tableau des créneaux et le compas des vents
 * lisent la même fonction, et deux abréviations pour la même direction sur une
 * même page se remarquent tout de suite.
 *
 * La convention est MARINE — le secteur est celui d'où souffle le vent, jamais
 * celui vers lequel il va. C'est l'inverse de ce qu'affichent certaines
 * applications de voile, et l'inverser retournerait le sens de chaque valeur
 * sans qu'aucun test de type ne s'en aperçoive.
 */
export function cardinal(deg: number): string {
  const index = Math.round((((deg % 360) + 360) % 360) / 45) % 8;
  return CARDINALS[index] ?? 'N';
}
