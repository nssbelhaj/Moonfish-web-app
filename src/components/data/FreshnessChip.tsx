'use client';

import { useEffect, useState } from 'react';
import { formatAge, freshnessOf, type Freshness } from '@/lib/data-freshness';
import type { SourceMeta } from '@/lib/providers';

/**
 * Puce de fraîcheur (R9, D13).
 *
 * Composant CLIENT, et c'est le fond du sujet. Les pages du spot sont en ISR
 * avec `revalidate = 3600` : le HTML servi peut avoir été produit il y a
 * cinquante-neuf minutes. Une fraîcheur calculée au rendu serait donc figée à
 * « à jour » dans le fichier statique, et le resterait quel que soit l'âge réel
 * de ce que le lecteur a sous les yeux — un voyant qui ne peut mesurer que
 * l'instant où il a été imprimé ne mesure rien.
 *
 * L'état est donc recalculé dans le navigateur, contre SON horloge, et
 * rafraîchi toutes les minutes tant que la page reste ouverte.
 *
 * Rendu serveur : la puce affiche l'état calculé au build. Elle est juste au
 * moment où elle est produite et se corrige à l'hydratation ; l'alternative
 * (ne rien afficher avant hydratation) ferait sauter la ligne sous les yeux du
 * lecteur et laisserait la donnée sans provenance si le JS ne charge pas.
 */
export function FreshnessChip({
  source,
  refreshedAt,
  serverNow,
}: {
  source: SourceMeta;
  refreshedAt: string | null;
  /** Instant de rendu serveur, pour un premier affichage cohérent. */
  serverNow: string;
}) {
  const [freshness, setFreshness] = useState<Freshness>(() =>
    freshnessOf(source, refreshedAt, new Date(serverNow)),
  );

  useEffect(() => {
    const update = () => setFreshness(freshnessOf(source, refreshedAt, new Date()));
    update();
    const timer = setInterval(update, 60_000);
    return () => clearInterval(timer);
  }, [source, refreshedAt]);

  const age = freshness.ageHours === null ? null : formatAge(freshness.ageHours);

  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-block h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: freshness.colorVar }}
        aria-hidden="true"
      />
      <span className="font-600 text-fg-muted">{freshness.label}</span>
      {age ? <span className="text-fg-faint">· {age}</span> : null}
    </span>
  );
}
