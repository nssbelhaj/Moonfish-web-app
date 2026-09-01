/**
 * Les raisons du score.
 *
 * Le score n'apparaît JAMAIS sans deux ou trois raisons en langage naturel. Ce
 * composant n'est donc pas optionnel : il accompagne systématiquement le
 * cartouche.
 *
 * Il porte sa propre carte plutôt que de flotter sous le cartouche : posées à
 * même la page, les phrases se lisaient comme une légende décorative alors
 * qu'elles sont ce qui rend le chiffre défendable.
 */
export function ScoreReasons({ reasons }: { reasons: readonly string[] }) {
  return (
    <div className="surface mt-3 p-[14px]">
      <h3 className="card-title">Pourquoi ce score</h3>
      <ul className="mt-2 space-y-2">
        {reasons.map((reason) => (
          <li key={reason} className="text-body nums text-fg-muted">
            {reason}
          </li>
        ))}
      </ul>
    </div>
  );
}
