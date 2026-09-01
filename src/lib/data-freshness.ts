import type { DataKind, SourceMeta } from '@/lib/providers';

/**
 * Les quatre états de fraîcheur d'un bloc de données (R9, D13).
 *
 * - `fresh`      — la donnée est dans sa fenêtre de validité.
 * - `stale`      — elle a dépassé cette fenêtre sans être renouvelée.
 * - `interrupted`— le fournisseur réel a échoué, on affiche un repli simulé.
 * - `pending`    — on ne sait pas de quand elle date. Ce n'est pas « à jour ».
 */
export type FreshnessState = 'fresh' | 'stale' | 'interrupted' | 'pending';

/**
 * Durée de validité PAR DÉFAUT d'une nature de donnée, en heures.
 * `null` = ne périme pas. Une source peut la remplacer via `validityHours`.
 *
 * Le handoff R9 ne donne qu'un seuil unique de 3 h. Appliqué tel quel, il aurait
 * marqué « ancien » en permanence deux blocs sur trois :
 *
 *  - les marées sont de l'ASTRONOMIE, prédites des mois à l'avance et mises en
 *    cache 24 à 72 h exprès ; une table de marée de la veille n'a rien perdu de
 *    sa justesse ;
 *  - le lever du soleil et la lune sont calculés localement à chaque rendu, ils
 *    ne peuvent pas vieillir du tout.
 *
 * Un voyant qui s'allume alors que tout va bien apprend à l'utilisateur à ne
 * plus le regarder — et le jour où le vent date vraiment de six heures, il ne le
 * verra pas. Les seuils sont donc calés sur ce que chaque donnée perd RÉELLEMENT
 * avec le temps.
 */
export const DEFAULT_VALIDITY_HOURS: Record<DataKind, number | null> = {
  /** Une mesure décrit un instant passé : elle se périme vite. */
  measured: 3,
  /** Une prévision horaire reste exploitable une demi-journée. */
  forecast: 6,
  /** Calcul local : recalculé à chaque rendu, il ne vieillit pas. */
  computed: null,
  /** Déjà signalé comme non réel ; la fraîcheur n'a pas de sens. */
  simulated: null,
};

/**
 * Durée de validité effective d'une source : la sienne si elle la déclare,
 * sinon le défaut de sa nature.
 */
export function validityHoursOf(source: SourceMeta): number | null {
  return source.validityHours === undefined
    ? DEFAULT_VALIDITY_HOURS[source.kind]
    : source.validityHours;
}

export interface Freshness {
  state: FreshnessState;
  /** Âge de la donnée en heures, `null` si inconnu ou sans objet. */
  ageHours: number | null;
  /** Libellé court affiché dans la puce. */
  label: string;
  /** Variable CSS de la puce. */
  colorVar: string;
}

const PRESENTATION: Record<FreshnessState, { label: string; colorVar: string }> = {
  fresh: { label: 'À jour', colorVar: 'var(--accent)' },
  stale: { label: 'Ancien', colorVar: 'var(--warn)' },
  interrupted: { label: 'Interrompu', colorVar: 'var(--danger)' },
  pending: { label: 'En attente', colorVar: 'var(--edge-strong)' },
};

/**
 * État de fraîcheur d'un bloc.
 *
 * `refreshedAt` est l'horodatage rendu par le FOURNISSEUR, pas l'instant de
 * rendu de la page : c'est toute la différence entre « la donnée date de » et
 * « on a affiché la page à ». `now` est laissé en paramètre pour que la fonction
 * reste pure et testable — et pour qu'elle puisse être évaluée côté navigateur,
 * là où l'horloge est celle du lecteur et pas celle du build.
 */
export function freshnessOf(
  source: SourceMeta,
  refreshedAt: string | null | undefined,
  now: Date,
): Freshness {
  // Une panne prime sur tout le reste : inutile de dater une donnée de repli.
  if (source.degraded === true) {
    return { state: 'interrupted', ageHours: null, ...PRESENTATION.interrupted };
  }

  const validity = validityHoursOf(source);

  if (validity === null) {
    // Ni périmable, ni suspecte : on n'invente pas d'état intermédiaire.
    return { state: 'fresh', ageHours: null, ...PRESENTATION.fresh };
  }

  if (!refreshedAt) {
    return { state: 'pending', ageHours: null, ...PRESENTATION.pending };
  }

  const stamp = new Date(refreshedAt).getTime();
  if (Number.isNaN(stamp)) {
    return { state: 'pending', ageHours: null, ...PRESENTATION.pending };
  }

  // Un horodatage dans le futur est une anomalie d'horloge, pas une fraîcheur
  // exemplaire : on le traite comme un âge nul plutôt que comme un âge négatif.
  const ageHours = Math.max(0, (now.getTime() - stamp) / 3_600_000);
  const state: FreshnessState = ageHours > validity ? 'stale' : 'fresh';

  return { state, ageHours, ...PRESENTATION[state] };
}

/** « il y a 2 h 10 », « il y a 4 min ». Jamais de fausse précision à la seconde. */
export function formatAge(ageHours: number): string {
  const minutes = Math.round(ageHours * 60);
  if (minutes < 1) return 'à l’instant';
  if (minutes < 60) return `il y a ${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours < 24) {
    return rest === 0 ? `il y a ${hours} h` : `il y a ${hours} h ${String(rest).padStart(2, '0')}`;
  }

  const days = Math.floor(hours / 24);
  return days === 1 ? 'il y a 1 jour' : `il y a ${days} jours`;
}
