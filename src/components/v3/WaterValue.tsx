/**
 * Grandeur d'eau (D20).
 *
 * Coefficient, hauteur, houle, période, état de marée, sonde, température :
 * TOUJOURS en Spectral italique accent. C'est la seule convention qui permet de
 * repérer une valeur hydrographique dans un tableau dense sans ajouter d'icône
 * ni de couleur supplémentaire — et elle vaut aussi dans les SVG, où elle est
 * portée par `WATER_TEXT_PROPS`.
 *
 * Elle est ici, en un composant, plutôt que répétée en vingt endroits : une
 * convention dispersée cesse d'en être une.
 */
export function WaterValue({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <span className={`water-value ${className}`}>{children}</span>;
}

/** Mêmes rôles typographiques, pour un `<text>` SVG. */
export const WATER_TEXT_PROPS = {
  fontFamily: 'var(--font-spectral), Spectral, Georgia, serif',
  fontStyle: 'italic' as const,
  fill: 'var(--accent)',
};

/** Chiffres d'interface dans un SVG : Archivo, chasse tabulaire. */
export const UI_TEXT_PROPS = {
  fontFamily: 'var(--font-archivo), Archivo, system-ui, sans-serif',
  style: { fontVariantNumeric: 'tabular-nums' as const },
};
