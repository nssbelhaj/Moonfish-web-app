/**
 * Rose des vents en filigrane (R8).
 *
 * Uniquement dans le cartouche de score, à 0,12–0,16 d'opacité. Décorative :
 * `aria-hidden`, et débordant volontairement du coin supérieur droit pour
 * suggérer un instrument plutôt que d'illustrer une direction.
 */
export function CompassMark() {
  return (
    <svg
      viewBox="0 0 120 120"
      aria-hidden="true"
      className="pointer-events-none absolute -right-6 -top-5 h-[140px] w-[140px] opacity-[0.12]"
    >
      <g stroke="var(--accent)" fill="none">
        <circle cx="60" cy="60" r="52" />
        <circle cx="60" cy="60" r="34" />
        <path d="M60,4 L60,116 M4,60 L116,60 M20,20 L100,100 M100,20 L20,100" />
        <path d="M60,8 L70,60 L60,112 L50,60 Z" fill="var(--accent)" fillOpacity="0.5" stroke="none" />
      </g>
    </svg>
  );
}
