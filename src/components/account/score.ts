import type { ForecastSlot } from '@/lib/forecast';
import { formatScore, tierForOrNull } from '@/lib/score-display';

/** Score et couleur d'un créneau, ou l'absence de données, en un seul objet. */
export interface Score {
  text: string;
  color: string;
  label: string;
}

export function scoreOf(slot: ForecastSlot | null): Score {
  const value = slot?.score.value ?? null;
  const danger = slot?.score.safety.level === 'danger';
  const tier = tierForOrNull(value);
  return {
    text: formatScore(value),
    // Le danger PRIME sur le score : houle et vent déclenchent la règle de
    // sécurité même quand la note reste correcte, et c'est précisément le cas
    // où l'on risque de partir quand même.
    color: danger ? 'var(--danger)' : (tier?.colorVar ?? 'var(--edge-strong)'),
    label: danger ? 'Danger' : (tier?.label ?? 'Indispo.'),
  };
}
