import { ScoreBreakdown } from '@/components/score/ScoreBreakdown';
import type { Moment } from '@/lib/forecast/moments';

/**
 * Le détail du calcul du créneau mis en avant, dépliable.
 *
 * ─── Pourquoi ici, et pourquoi replié ─────────────────────────────────────
 *
 * « Faites-nous confiance, c'est 8,4 » est exactement ce que fait un site
 * concurrent. La page peut montrer le calcul qui vient de produire le
 * chiffre au-dessus : c'est la démonstration de la promesse, sur une donnée
 * réelle, avant même d'ouvrir une page de spot.
 *
 * Replié dans un `<details>` : déployé, il ferait quarante lignes de tableau
 * à la place du contenu, et il n'a pas besoin de JavaScript pour s'ouvrir.
 * Le marqueur natif est CONSERVÉ — d'où l'absence de `list-none` et de
 * `flex` sur le `summary`, qui le feraient tous deux disparaître.
 */
export function PourquoiCeScore({ moment }: { moment: Moment }) {
  return (
    <details className="surface mt-4 px-4 py-2">
      <summary className="cursor-pointer py-3 text-body font-600 text-fg marker:text-fg-muted">
        Pourquoi ce score ? Le détail du calcul pour {moment.spot.name}
      </summary>
      <div className="mt-2 pb-2">
        <ScoreBreakdown score={moment.slot.score} />
      </div>
    </details>
  );
}
