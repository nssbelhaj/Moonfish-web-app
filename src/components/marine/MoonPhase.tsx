import { moonPhaseName } from '@/lib/scoring';

/**
 * Disque lunaire.
 *
 * La partie éclairée est dessinée par deux arcs, pas par un dégradé : c'est un
 * instrument, il doit rester lisible à contre-jour et en niveaux de gris.
 * La lunaison est calculée localement, elle n'est donc pas marquée « simulée ».
 */
export function MoonPhase({
  ageDays,
  illuminationPct,
  size = 64,
}: {
  ageDays: number;
  illuminationPct: number;
  size?: number;
}) {
  const phase = moonPhaseName(ageDays);
  const radius = 30;
  const waxing = ageDays < 14.77;

  // Demi-largeur du terminateur : positive en croissant, négative en gibbeuse.
  const k = Math.cos((2 * Math.PI * ageDays) / 29.530588);
  const sweepInner = waxing ? (k > 0 ? 1 : 0) : k > 0 ? 0 : 1;

  return (
    <div className="flex items-center gap-4">
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        role="img"
        aria-label={`${phase}, ${Math.round(illuminationPct)} pour cent du disque éclairé.`}
      >
        <circle cx="32" cy="32" r={radius} fill="var(--card-raised)" stroke="var(--edge-strong)" strokeWidth="1" />
        <path
          d={`M 32 2
              A ${radius} ${radius} 0 0 ${waxing ? 1 : 0} 32 62
              A ${Math.abs(k) * radius} ${radius} 0 0 ${sweepInner} 32 2 Z`}
          fill="var(--fg)"
        />
      </svg>

      <div>
        <p className="text-h3 font-600">{phase}</p>
        <p className="mt-1 font-mono text-data text-fg-muted" data-numeric="">
          {Math.round(illuminationPct)} % éclairée · {ageDays.toFixed(1).replace('.', ',')} j de lunaison
        </p>
      </div>
    </div>
  );
}
