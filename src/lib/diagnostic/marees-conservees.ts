import type { Point } from './etat';
import type { TideTableStore } from '@/lib/providers/marees/store';
import { HORIZON_REQUIS_MS } from '@/lib/providers/marees/persistant';

/**
 * L'état des tables de marée conservées : combien, jusqu'où, depuis quand.
 *
 * C'est la réponse à « pourquoi telle page affiche encore des marées
 * simulées ? » : parce que sa table n'est pas encore là, ou ne couvre plus.
 * Le diagnostic le dit avec les chiffres, spot par spot s'il le faut.
 */
export async function etatDesMareesConservees(
  store: TideTableStore,
  attendus: readonly string[],
  now: Date = new Date(),
): Promise<Point> {
  const sujet = 'Tables de marée conservées';

  let tables: Awaited<ReturnType<TideTableStore['toutes']>>;
  try {
    tables = await store.toutes();
  } catch (error) {
    return {
      sujet,
      etat: 'attention',
      constat: `La table tide_tables est illisible : ${error instanceof Error ? error.message : String(error)}.`,
      remede: 'Vérifiez que la migration 0008 est appliquée (point « Migrations » ci-dessus).',
    };
  }

  const requis = now.getTime() + HORIZON_REQUIS_MS;
  const parSlug = new Map(tables.map((table) => [table.pointSlug, table]));
  const points = ['brest', ...attendus];
  const absents = points.filter((slug) => !parSlug.has(slug));
  const courts = points.filter((slug) => {
    const table = parSlug.get(slug);
    return table !== undefined && new Date(table.coversTo).getTime() < requis;
  });
  const couverts = points.length - absents.length - courts.length;

  const horizonMin = tables.length
    ? Math.min(...tables.map((t) => (new Date(t.coversTo).getTime() - now.getTime()) / 86_400_000))
    : null;

  const liste = (slugs: string[]) =>
    slugs.length <= 6 ? slugs.join(', ') : `${slugs.slice(0, 6).join(', ')} et ${slugs.length - 6} autres`;

  if (absents.length === 0 && courts.length === 0) {
    return {
      sujet,
      etat: 'ok',
      constat: `${couverts} points couverts sur ${points.length} (Brest compris), horizon le plus court : ${horizonMin!.toFixed(1)} jours. Aucune requête ne part au rendu des pages.`,
      remede: null,
    };
  }

  return {
    sujet,
    etat: absents.includes('brest') ? 'absent' : 'attention',
    constat:
      `${couverts} points couverts sur ${points.length}. ` +
      (absents.length ? `Sans table encore : ${liste(absents)}. ` : '') +
      (courts.length ? `Couverture trop courte : ${liste(courts)}. ` : '') +
      'Ces spots affichent des marées simulées, annoncées comme telles, jusqu’au prochain rafraîchissement.',
    remede:
      'La tâche d’entretien rafraîchit huit points par jour au plus : appelez /api/entretien une fois par jour et attendez une semaine pour couvrir tout le catalogue. Si rien ne bouge d’un jour à l’autre, lisez le point « Essai Stormglass ».',
  };
}
