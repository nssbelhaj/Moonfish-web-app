import { classifyWind, WIND_EXPOSURE_LABEL } from '@/lib/scoring';

const CARDINALS = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'] as const;

/**
 * Seules les quatre directions cardinales sont écrites (R9).
 *
 * Huit libellés autour d'un cercle de 92 px se touchent et deviennent une
 * couronne de bruit. Les quatre points principaux suffisent à orienter le
 * regard ; la direction exacte est de toute façon écrite en toutes lettres à
 * côté, ce que R9 exige précisément pour ne pas dépendre du dessin.
 */
const SHOWN = ['N', 'E', 'S', 'O'] as const;

function cardinal(deg: number): string {
  const index = Math.round((((deg % 360) + 360) % 360) / 45) % 8;
  return CARDINALS[index] ?? 'N';
}

/**
 * Compas des vents.
 *
 * L'aiguille indique D'OÙ VIENT le vent (convention marine), pas où il va. Le
 * libellé « vent de mer / de terre » est calculé depuis l'orientation du spot :
 * c'est l'information que le pêcheur cherche, les degrés ne sont là que pour la
 * vérification.
 *
 * Forme imposée par R9 : cercle extérieur plein, cercle intérieur POINTILLÉ,
 * N/E/S/O, flèche PLEINE — un simple trait se lit mal à contre-jour et ne dit
 * pas de quel côté il pointe.
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

  // Les deux épaules de la flèche, à 90° de l'axe, près de la pointe.
  const shoulder = angle + Math.PI / 2;
  const shoulderR = radius * 0.42;
  const leftX = center + Math.cos(angle) * shoulderR + Math.cos(shoulder) * 7;
  const leftY = center + Math.sin(angle) * shoulderR + Math.sin(shoulder) * 7;
  const rightX = center + Math.cos(angle) * shoulderR - Math.cos(shoulder) * 7;
  const rightY = center + Math.sin(angle) * shoulderR - Math.sin(shoulder) * 7;

  return (
    <div className="flex items-center gap-4">
      <svg
        width={size}
        height={size}
        viewBox="0 0 120 120"
        role="img"
        aria-label={`Vent de ${Math.round(speedKmh)} kilomètres par heure venant du secteur ${cardinal(fromDeg)}, soit un ${label}.${gustKmh === null ? '' : ` Rafales à ${Math.round(gustKmh)}.`}`}
      >
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="var(--edge-strong)"
          strokeWidth="1"
        />
        <circle
          cx={center}
          cy={center}
          r={radius / 2}
          fill="none"
          stroke="var(--edge)"
          strokeWidth="1"
          strokeDasharray="2 4"
        />

        {SHOWN.map((name) => {
          const index = CARDINALS.indexOf(name);
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

        {/*
          Flèche PLEINE plutôt qu'un trait : à contre-jour, un segment ne dit pas
          de quel côté il pointe. La queue étroite et la pointe large lèvent
          l'ambiguïté d'un seul regard.
        */}
        <path
          d={`M${tipX.toFixed(1)},${tipY.toFixed(1)} L${leftX.toFixed(1)},${leftY.toFixed(1)} L${center},${center} L${rightX.toFixed(1)},${rightY.toFixed(1)} Z`}
          fill="var(--accent)"
        />
        <circle cx={center} cy={center} r="3" fill="var(--fg)" />
      </svg>

      <div>
        <p className="nums text-score-sm" data-numeric="">
          {Math.round(speedKmh)}
          <span className="text-body font-semibold text-fg-muted"> km/h</span>
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
