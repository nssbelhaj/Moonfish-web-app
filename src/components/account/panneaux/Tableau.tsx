import type { Catch, Outing, SpotReview } from '@/data/schemas';
import { formatMeasures, formatMonth, type CatchLogSummary } from '@/lib/contributions/catch-log';

/**
 * Le tableau de bord du carnet : ce qu'une liste de prises dit une fois relue.
 *
 * ─── Ce qu'on mesure, et ce qu'on refuse de mesurer ───────────────────────
 *
 * Chaque chiffre est un FAIT vérifiable dans la liste juste en dessous :
 * combien, de quoi, où, quand, quelle taille. Aucun n'est une appréciation.
 * « Votre meilleur mois » est un fait ; « vous progressez » serait une
 * flatterie qu'aucune donnée ne soutient, et « plus que 3 prises pour le
 * niveau suivant » transformerait un carnet en machine à faire sortir les
 * gens par mauvais temps. Ce site dit quand ne PAS y aller ; il ne peut pas
 * récompenser le fait d'y aller.
 *
 * Un chiffre qui n'existe pas s'écrit « — », jamais 0 : « 0 cm » laisserait
 * croire à une mesure, alors qu'il s'agit d'une absence de mesure.
 */

interface Case {
  terme: string;
  valeur: string;
  /** Précision sous le chiffre, quand le chiffre seul serait ambigu. */
  detail?: string;
}

export function TableauDeBord({
  carnet,
  catches,
  reviews,
  outings,
  favoris,
  nameOf,
}: {
  carnet: CatchLogSummary;
  catches: readonly Catch[];
  reviews: readonly SpotReview[];
  outings: readonly Outing[];
  favoris: number;
  nameOf: (slug: string) => string;
}) {
  const publiees = catches.filter((c) => c.visibility === 'publique').length;
  const meilleurMois = [...carnet.byMonth].sort((a, b) => b.count - a.count)[0];
  const spotFavori = carnet.bySpot[0];
  const especeFavorite = carnet.bySpecies[0];

  const plusLourdeG = Math.max(0, ...carnet.bySpecies.map((e) => e.bestWeightG ?? 0));

  // Douze mois glissants : ce que l'année écoulée a donné, pas un total de
  // toujours qui ne bougerait plus.
  const surDouzeMois = carnet.byMonth.reduce((total, m) => total + m.count, 0);

  const cases: Case[] = [
    { terme: 'Prises', valeur: String(carnet.total), detail: `dont ${publiees} publiée${publiees > 1 ? 's' : ''}` },
    { terme: 'Sur 12 mois', valeur: String(surDouzeMois) },
    { terme: 'Espèces', valeur: String(carnet.distinctSpecies) },
    { terme: 'Spots pêchés', valeur: String(carnet.bySpot.length) },
    {
      terme: 'Plus longue',
      valeur: carnet.longest?.lengthCm ? `${carnet.longest.lengthCm} cm` : '—',
      ...(carnet.longest ? { detail: `${carnet.longest.species} · ${nameOf(carnet.longest.spotSlug)}` } : {}),
    },
    { terme: 'Plus lourde', valeur: plusLourdeG === 0 ? '—' : (formatMeasures(null, plusLourdeG) ?? '—') },
    {
      terme: 'Relâchées',
      valeur: carnet.releaseRate === null ? '—' : `${Math.round(carnet.releaseRate * 100)} %`,
      ...(carnet.total > 0 ? { detail: `${carnet.released} sur ${carnet.total}` } : {}),
    },
    {
      terme: 'Meilleur mois',
      valeur: meilleurMois === undefined || meilleurMois.count === 0 ? '—' : formatMonth(meilleurMois.month),
      ...(meilleurMois && meilleurMois.count > 0
        ? { detail: `${meilleurMois.count} prise${meilleurMois.count > 1 ? 's' : ''}` }
        : {}),
    },
    {
      terme: 'Spot le plus pêché',
      valeur: spotFavori ? nameOf(spotFavori.spotSlug) : '—',
      ...(spotFavori ? { detail: `${spotFavori.count} prise${spotFavori.count > 1 ? 's' : ''}` } : {}),
    },
    {
      terme: 'Espèce la plus prise',
      valeur: especeFavorite?.species ?? '—',
      ...(especeFavorite ? { detail: `${especeFavorite.count} fois` } : {}),
    },
    { terme: 'Avis publiés', valeur: String(reviews.length) },
    { terme: 'Sorties à venir', valeur: String(outings.length), detail: `${favoris} spot${favoris > 1 ? 's' : ''} en favori` },
  ];

  return (
    <dl className="tableau-bord">
      {cases.map(({ terme, valeur, detail }) => (
        <div key={terme} className="tableau-case">
          <dt className="tableau-terme">{terme}</dt>
          <dd className="tableau-valeur nums" data-numeric="">
            {valeur}
          </dd>
          {detail !== undefined && <dd className="tableau-detail">{detail}</dd>}
        </div>
      ))}
    </dl>
  );
}
