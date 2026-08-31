import type { TierPresentation } from '@/lib/score-display';

/**
 * La forme du palier. Quatrième canal après le chiffre, le libellé et la couleur :
 * elle seule survit à une capture en niveaux de gris.
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
      {tier.shape === 'square' && <rect x="4" y="4" width="16" height="16" fill={color} />}
      {tier.shape === 'diamond' && <path d="M12 2 L22 12 L12 22 L2 12 Z" fill={color} />}
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
