/**
 * Les raisons du score.
 *
 * Règle du handoff §2.2 : le score n'apparaît JAMAIS sans deux ou trois raisons
 * en langage naturel, en mono, sous lui. Ce composant n'est donc pas optionnel —
 * il accompagne systématiquement `ScoreGauge`.
 */
export function ScoreReasons({ reasons }: { reasons: readonly string[] }) {
  return (
    <ul className="mt-4 space-y-2">
      {reasons.map((reason) => (
        <li key={reason} className="text-meta nums leading-[1.45] text-fg-muted">
          {reason}
        </li>
      ))}
    </ul>
  );
}
