import Link from 'next/link';
import type { SafetyLevel } from '@/lib/scoring';

/**
 * Bandeau de sécurité (handoff §3).
 *
 * `danger` : rouge, bordure 2 px, NON refermable, collé en haut au scroll,
 * placé au-dessus du score. Il ne dépend jamais du score : un créneau peut être
 * halieutiquement excellent et humainement dangereux.
 *
 * `prudence` : variante ambre, discrète, qui ne masque rien.
 */
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

  if (level === 'danger') {
    return (
      <div
        role="alert"
        className="sticky top-0 z-30 border-2 border-score-bad-dark bg-alert-bg px-4 py-4 text-alert-ink"
        style={{ borderRadius: 10 }}
      >
        <p className="font-mono text-label uppercase tracking-[0.14em]">Danger — ne pas sortir</p>
        <p className="mt-2 text-body">{message}</p>
        {shelterHref && shelterCount !== undefined && shelterCount > 0 && (
          <Link
            href={shelterHref}
            className="mt-3 inline-flex min-h-[48px] items-center rounded-input border-2 border-score-bad-dark px-4 font-600 text-alert-ink"
          >
            Voir {shelterCount} spot{shelterCount > 1 ? 's' : ''} abrité
            {shelterCount > 1 ? 's' : ''} à moins de 20 km
          </Link>
        )}
      </div>
    );
  }

  return (
    <div
      role="status"
      className="border border-vigil-ink/40 bg-vigil-bg px-4 py-3 text-vigil-ink"
      style={{ borderRadius: 10 }}
    >
      <p className="font-mono text-label uppercase tracking-[0.14em]">Vigilance</p>
      <p className="mt-1.5 text-body">{message}</p>
    </div>
  );
}
