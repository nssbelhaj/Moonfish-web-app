import { DemoDataNotice } from '@/components/data/DemoDataNotice';
import type { Spot } from '@/data/schemas';
import { collectSources, getSpotSummary, referenceNow } from '@/lib/forecast';
import { SpotCard } from './SpotCard';

/**
 * Liste des spots avec leur score.
 *
 * Isolée dans son propre composant asynchrone pour être placée derrière un
 * `<Suspense>` : la coquille de /spots — dont ses métadonnées — est ainsi
 * envoyée immédiatement, sans attendre le calcul des 12 prévisions. Sans cette
 * séparation, Next diffère l'injection du `<title>` et de la `<meta name="description">`
 * dans le flux, et les robots qui ne rendent pas le JavaScript ne les voient pas.
 */
export async function SpotResults({ spots }: { spots: readonly Spot[] }) {
  const now = referenceNow();
  const summaries = await Promise.all(spots.map((spot) => getSpotSummary(spot, now)));
  summaries.sort((a, b) => (b.current?.score.value ?? 0) - (a.current?.score.value ?? 0));

  return (
    <>
      <div className="mt-4">
        <DemoDataNotice sources={collectSources(summaries)} />
      </div>
      <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {summaries.map((summary) => (
          <li key={summary.spot.slug}>
            <SpotCard summary={summary} />
          </li>
        ))}
      </ul>
    </>
  );
}

/** Squelette de chargement : aplats en `line`, sans pulsation ni spinner (handoff §6). */
export function SpotResultsSkeleton({ count }: { count: number }) {
  return (
    <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <li key={index} className="rounded-card border border-edge bg-card p-4">
          <div className="skeleton h-5 w-2/3" />
          <div className="skeleton mt-3 h-4 w-1/3" />
          <div className="skeleton mt-6 h-4 w-full" />
          <div className="skeleton mt-2 h-4 w-4/5" />
          <div className="skeleton mt-6 h-6 w-1/2" />
        </li>
      ))}
    </ul>
  );
}
