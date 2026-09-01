import type { TierPresentation } from '@/lib/score-display';

/**
 * La forme du palier — quatrième canal redondant après le chiffre, le libellé
 * et la couleur (R3). Elle seule survit à une capture en niveaux de gris.
 *
 * Le losange est CREUX et le trait PLAT : les quatre formes se distinguent
 * autant par leur remplissage que par leur silhouette, ce qui les sépare même
 * à 12 px.
 */
export function ScoreShape({
  tier,
  size = 14,
  className,
}: {
  tier: TierPresentation;
  size?: number;
  className?: string | undefined;
}) {
  const color = tier.colorVar;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      className={className}
      style={{ flexShrink: 0 }}
    >
      {tier.shape === 'bar' && <rect x="3" y="10.5" width="18" height="3" fill={color} />}
      {tier.shape === 'diamond' && (
        <path d="M12 3 L21 12 L12 21 L3 12 Z" fill="none" stroke={color} strokeWidth="2.5" />
      )}
      {tier.shape === 'disc' && <circle cx="12" cy="12" r="9" fill={color} />}
      {tier.shape === 'target' && (
        <>
          <circle cx="12" cy="12" r="10" fill="none" stroke={color} strokeWidth="2.5" />
          <circle cx="12" cy="12" r="4.5" fill={color} />
        </>
      )}
    </svg>
  );
}
