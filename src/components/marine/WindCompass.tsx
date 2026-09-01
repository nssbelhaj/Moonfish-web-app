import { classifyWind, WIND_EXPOSURE_LABEL } from '@/lib/scoring';

const CARDINALS = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'] as const;

function cardinal(deg: number): string {
  const index = Math.round((((deg % 360) + 360) % 360) / 45) % 8;
  return CARDINALS[index] ?? 'N';
}

/**
 * Compas des vents.
 *
 * L'aiguille indique D'OÙ VIENT le vent (convention marine, handoff §5), pas
 * où il va. Le libellé « vent de mer / de terre » est calculé depuis
 * l'orientation du spot : c'est l'information que le pêcheur cherche, les
 * degrés ne sont là que pour la vérification.
 */
export function WindCompass({
  fromDeg,
  speedKmh,
  gustKmh,
  spotFacingDeg,
  size = 120,
}: {
  fromDeg: number;
  speedKmh: number;
  /** Les rafales manquent sur certaines mailles : l'absence se dit. */
  gustKmh: number | null;
  spotFacingDeg: number;
  size?: number;
}) {
  const exposure = classifyWind(fromDeg, spotFacingDeg);
  const label = WIND_EXPOSURE_LABEL[exposure];
  const center = 60;
  const radius = 46;

  // L'aiguille pointe VERS le secteur d'origine : 0° = nord en haut.
  const angle = ((fromDeg - 90) * Math.PI) / 180;
  const tipX = center + Math.cos(angle) * (radius - 8);
  const tipY = center + Math.sin(angle) * (radius - 8);

  return (
    <div className="flex items-center gap-4">
      <svg
        width={size}
        height={size}
        viewBox="0 0 120 120"
        role="img"
        aria-label={`Vent de ${Math.round(speedKmh)} kilomètres par heure venant du secteur ${cardinal(fromDeg)}, soit un ${label}.${gustKmh === null ? '' : ` Rafales à ${Math.round(gustKmh)}.`}`}
      >
        <circle cx={center} cy={center} r={radius} fill="none" stroke="var(--edge)" strokeWidth="1" />
        <circle cx={center} cy={center} r={radius / 2} fill="none" stroke="var(--edge)" strokeWidth="1" />

        {CARDINALS.map((name, index) => {
          const a = ((index * 45 - 90) * Math.PI) / 180;
          return (
            <text
              key={name}
              x={center + Math.cos(a) * (radius + 9)}
              y={center + Math.sin(a) * (radius + 9) + 4}
              textAnchor="middle"
              fontSize="10"
              fill="var(--fg-muted)"
              fontFamily="var(--font-archivo), Archivo, system-ui, sans-serif"
                style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {name}
            </text>
          );
        })}

        <line
          x1={center}
          y1={center}
          x2={tipX}
          y2={tipY}
          stroke="var(--score-3)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <circle cx={center} cy={center} r="3" fill="var(--fg)" />
      </svg>

      <div>
        <p className="nums text-score-sm" data-numeric="">
          {Math.round(speedKmh)}
          <span className="text-body font-semibold font-500 text-fg-faint"> km/h</span>
        </p>
        <p className="mt-1 text-meta nums text-fg-muted" data-numeric="">
          {gustKmh === null ? 'rafales indispo.' : `rafales ${Math.round(gustKmh)} km/h`}
        </p>
        <p className="mt-1 text-meta nums text-fg-muted">
          {label} · secteur {cardinal(fromDeg)} ({Math.round(fromDeg)}°)
        </p>
      </div>
    </div>
  );
}
