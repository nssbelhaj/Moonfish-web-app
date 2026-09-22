import Link from 'next/link';

import { paysPath } from '@/data/pays';
import { formatScore } from '@/lib/score-display';

import { MiniCarte, type PointCarte } from './MiniCarte';

export interface CartePays {
  slug: string;
  nom: string;
  spots: number;
  /** « Bretagne, Normandie +3 » */
  regions: string;
  /** Une phrase de la fiche : ce que ce pays a de particulier. */
  accroche: string;
  meilleur: number | null;
  meilleurSpot: string | null;
  points: PointCarte[];
}

/**
 * Les trois pays, en cartes qui MÈNENT QUELQUE PART.
 *
 * Elles étaient des boutons de filtre. Elles sont des liens vers la page du
 * pays — celle qui dit ce qui change d'un pays à l'autre — et le filtre de
 * l'accueil est devenu un sélecteur à part, plus haut. Une carte qui a l'air
 * d'un lien et qui ne fait que masquer du contenu trompe deux fois.
 *
 * La vignette n'est pas une illustration : ce sont les spots du pays, à leurs
 * vraies coordonnées, et le littoral apparaît tout seul.
 */
export function CartesPays({ cartes }: { cartes: readonly CartePays[] }) {
  return (
    <ul className="grid gap-4 md:grid-cols-3">
      {cartes.map((pays) => (
        <li key={pays.slug}>
          <Link
            href={paysPath(pays.slug)}
            className="surface tappable relative flex h-full flex-col gap-4 p-5 hover:bg-surface-2"
          >
            <div className="flex items-start gap-4">
              <span className="h-24 w-24 shrink-0 rounded-inner bg-surface-2 p-1.5">
                <MiniCarte points={pays.points} label={`Les spots ${pays.nom}`} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-serif text-h2 font-semibold text-fg">{pays.nom}</span>
                <span className="mt-1 block text-meta nums text-fg-muted" data-numeric="">
                  {pays.spots} spots · {pays.regions}
                </span>
                <span className="mt-2 block text-meta nums text-fg" data-numeric="">
                  {pays.meilleur === null || pays.meilleurSpot === null
                    ? 'Score indisponible'
                    : `Meilleur maintenant : ${formatScore(pays.meilleur)}/10 à ${pays.meilleurSpot}`}
                </span>
              </span>
            </div>

            <p className="text-body text-fg-muted">{pays.accroche}</p>

            <span className="mt-auto inline-flex min-h-[24px] items-center text-meta font-600 text-fg underline decoration-dotted underline-offset-4">
              Ouvrir la page {pays.nom} →
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
