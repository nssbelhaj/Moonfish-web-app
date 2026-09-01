/**
 * Poisson stylisé, marqueur d'activité attendue.
 *
 * Instrument et non illustration : silhouette pleine, pas d'ombre, pas de
 * dégradé, lisible à 14 px comme à contre-jour. La couleur reprend celle du
 * palier, si bien que le marqueur porte deux canaux — la présence et le niveau.
 */
export function FishGlyph({
  size = 18,
  color,
  className,
}: {
  size?: number;
  color: string;
  className?: string | undefined;
}) {
  return (
    <svg
      width={size}
      height={(size * 12) / 24}
      viewBox="0 0 24 12"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <path d="M2 6 C 5 1, 13 1, 17 6 C 13 11, 5 11, 2 6 Z" fill={color} />
      <path d="M16.5 6 L 22 2 L 22 10 Z" fill={color} />
      <circle cx="6.2" cy="4.9" r="0.9" fill="var(--page)" />
    </svg>
  );
}
