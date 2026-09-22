import { projeter, type PointCarte } from '@/components/accueil/MiniCarte';
import { tierForOrNull } from '@/lib/score-display';

export interface PointConstellation extends PointCarte {
  href: string;
  regionName: string;
  /** Score du créneau en cours, pour teinter le point. */
  score: number | null;
  danger: boolean;
}

/**
 * La constellation d'un pays, en grand et cliquable.
 *
 * Même projection que la vignette de l'accueil — équirectangulaire, corrigée
 * du cosinus, une seule échelle pour les deux axes — mais chaque point est
 * un LIEN vers son spot, teinté par son score du moment et nommé au survol.
 *
 * Pas de fond de carte : le trait du littoral est donné par les positions
 * elles-mêmes, et il est exact parce qu'il n'est fait que de positions
 * réelles. La carte à tuiles existe à /carte pour qui veut le fond.
 */
export function ConstellationPays({
  points,
  label,
}: {
  points: readonly PointConstellation[];
  label: string;
}) {
  const projetes = projeter(points);
  const parSlug = new Map(points.map((p) => [p.slug, p]));

  return (
    <svg viewBox="0 0 100 100" className="h-auto w-full" role="group" aria-label={label}>
      {projetes.map((p) => {
        const point = parSlug.get(p.slug)!;
        const tier = tierForOrNull(point.score);
        const teinte = point.danger
          ? 'var(--danger)'
          : (tier?.colorVar ?? 'var(--fg-muted)');
        const infobulle = `${point.name} — ${point.regionName}${
          point.score === null ? '' : ` · ${point.score.toFixed(1).replace('.', ',')}/10`
        }`;
        return (
          <a key={p.slug} href={point.href} aria-label={`${point.name}, ${point.regionName}`}>
            {/* Une zone de clic plus large que le point visible. */}
            <circle cx={p.x} cy={p.y} r={4.5} fill="transparent" />
            <circle cx={p.x} cy={p.y} r={2.2} fill={teinte} stroke="var(--card)" strokeWidth={0.6}>
              {/*
                UNE SEULE chaîne dans le `<title>`, jamais plusieurs enfants.
                React 19 exige qu'un `<title>` ait pour enfant une chaîne
                unique ; avec `{a} — {b}`, le rendu SERVEUR le vide (« <title>
                </title> ») tandis que le client rend le texte. Le HTML ne
                correspond plus et toute la page se réhydrate à blanc —
                erreur React 418, sans autre indice en production. Trouvé en
                comparant le HTML servi au DOM rendu.
              */}
              <title>{infobulle}</title>
            </circle>
          </a>
        );
      })}
    </svg>
  );
}
