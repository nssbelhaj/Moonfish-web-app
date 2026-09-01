import Link from 'next/link';
import type { SafetyLevel } from '@/lib/scoring';

/**
 * Bandeau de sécurité — R6, R7, §06.
 *
 * Seul composant du produit à porter une bordure : la sécurité n'est pas une
 * surface parmi d'autres. Non refermable, sans croix, sticky sous l'en-tête,
 * placé au-dessus du score.
 *
 * Il ne dépend jamais du score (R7) : un 9,1 avec 2,8 m de houle affiche le
 * bandeau, et le score n'est pas atténué pour autant — ce sont deux
 * informations, pas une moyenne.
 */
function WarningTriangle({ className }: { className?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={className}>
      <path
        d="M12 3 L22 20.5 H2 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M12 9.5 V14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="17" r="1.15" fill="currentColor" />
    </svg>
  );
}

export function SafetyBanner({
  level,
  message,
  shelterHref,
  shelterCount,
}: {
  level: SafetyLevel;
  message: string | undefined;
  /** Repli obligatoire en cas de danger : où aller à la place. */
  shelterHref?: string;
  shelterCount?: number;
}) {
  if (level === 'ok' || !message) return null;

  const isDanger = level === 'danger';

  return (
    <div
      role="alert"
      className={`surface sticky top-0 z-30 border-2 p-4 ${
        isDanger ? 'border-danger' : 'border-accent-score'
      }`}
    >
      <p
        className={`flex items-center gap-2 text-body font-semibold ${
          isDanger ? 'text-danger' : 'text-accent-score'
        }`}
      >
        <WarningTriangle />
        {isDanger ? 'Danger — ne pas sortir' : 'Vigilance'}
      </p>

      <p className="mt-2 max-w-prose text-body text-fg">{message}</p>

      {isDanger && shelterHref && shelterCount !== undefined && shelterCount > 0 && (
        <Link
          href={shelterHref}
          className="tappable mt-3 inline-flex min-h-tap items-center rounded-ctl bg-surface-2 px-4 font-semibold text-fg hover:bg-edge"
        >
          Voir {shelterCount} spot{shelterCount > 1 ? 's' : ''} abrité
          {shelterCount > 1 ? 's' : ''} à moins de 20 km
        </Link>
      )}
    </div>
  );
}
