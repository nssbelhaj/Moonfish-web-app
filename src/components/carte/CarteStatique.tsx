import { TAILLE_TUILE, cadrer, mercator, tuilesDe } from '@/lib/carte/statique';
import { tierForOrNull } from '@/lib/score-display';

export interface PointCarte {
  slug: string;
  name: string;
  lat: number;
  lng: number;
  /** Lien vers le spot ; sans lui, le point est décoratif. */
  href?: string;
  regionName?: string;
  score?: number | null;
  danger?: boolean;
}

/**
 * Une carte statique : le fond OpenStreetMap par notre proxy, et les spots
 * dessus, dans le même SVG et la même projection.
 *
 * ─── Ce qu'elle remplace ─────────────────────────────────────────────────
 *
 * La constellation sans fond « laissait le littoral apparaître de lui-même ».
 * À vingt points, on devinait la France ; à cinq, on voyait cinq points, et
 * à Tanger trois points l'un sur l'autre. Un lecteur ne doit pas deviner :
 * ici la côte est dessinée, et le point est au pixel près dessus.
 *
 * ─── Ce qu'elle coûte, et ce qu'elle ne coûte pas ─────────────────────────
 *
 * `tuilesMax` borne le nombre de tuiles par carte — deux pour une vignette,
 * neuf pour un héros — donc le coût réseau, par construction. Les tuiles
 * viennent de `/api/tuiles`, déjà en place pour la carte interactive, avec
 * son cache d'un an : le navigateur ne joint aucun tiers, et OpenStreetMap
 * ne voit ni l'adresse du visiteur ni ce qu'il regarde. L'attribution est
 * VISIBLE, sous la carte, comme la licence le demande.
 *
 * `<image>` dans un SVG plutôt que des `<img>` positionnés : un seul système
 * de coordonnées pour les tuiles et les points, et la carte se redimensionne
 * avec la page sans rien recalculer.
 */
export function CarteStatique({
  points,
  label,
  tuilesMax = 9,
  ratio = 1,
  rayon = 0.014,
  attribution = true,
}: {
  points: readonly PointCarte[];
  label: string;
  tuilesMax?: number;
  /** Largeur / hauteur de la carte. */
  ratio?: number;
  /** Rayon des points, en fraction de la largeur de la vue. */
  rayon?: number;
  attribution?: boolean;
}) {
  const cadrage = cadrer(points, { tuilesMax, ratio });
  if (cadrage === null) return null;

  const { vue, z } = cadrage;
  const r = vue.largeur * rayon;
  const interactif = points.some((p) => p.href !== undefined);

  return (
    <figure className="m-0">
      <svg
        viewBox={`${vue.x} ${vue.y} ${vue.largeur} ${vue.hauteur}`}
        className="block h-auto w-full rounded-inner"
        role={interactif ? 'group' : 'img'}
        aria-label={label}
      >
        {/* Le thème nuit assombrit les tuiles : la même règle que la carte interactive. */}
        <g className="carte-tuiles">
          {tuilesDe(cadrage).map((tuile) => (
            <image
              key={`${tuile.z}/${tuile.x}/${tuile.y}`}
              href={`/api/tuiles/${tuile.z}/${tuile.x}/${tuile.y}`}
              x={tuile.px}
              y={tuile.py}
              width={TAILLE_TUILE}
              height={TAILLE_TUILE}
            />
          ))}
        </g>

        {points.map((point) => {
          const p = mercator(point, z);
          const tier = tierForOrNull(point.score ?? null);
          const teinte = point.danger ? 'var(--danger)' : (tier?.colorVar ?? 'var(--accent)');
          const infobulle = `${point.name}${point.regionName ? ` — ${point.regionName}` : ''}${
            point.score === null || point.score === undefined
              ? ''
              : ` · ${point.score.toFixed(1).replace('.', ',')}/10`
          }`;
          const cercles = (
            <>
              {interactif && <circle cx={p.x} cy={p.y} r={r * 2.2} fill="transparent" />}
              <circle cx={p.x} cy={p.y} r={r} fill={teinte} stroke="var(--card)" strokeWidth={r * 0.35}>
                <title>{infobulle}</title>
              </circle>
            </>
          );
          return point.href ? (
            <a key={point.slug} href={point.href} aria-label={infobulle}>
              {cercles}
            </a>
          ) : (
            <g key={point.slug}>{cercles}</g>
          );
        })}
      </svg>
      {attribution && (
        <figcaption className="mt-1 text-src text-fg-muted">
          Fond © les contributeurs d’
          <a
            href="https://www.openstreetmap.org/copyright"
            className="underline decoration-dotted underline-offset-4"
            rel="noreferrer"
          >
            OpenStreetMap
          </a>
          , servi par nos serveurs.
        </figcaption>
      )}
    </figure>
  );
}
