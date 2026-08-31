import type { SourceMeta } from '@/lib/providers';

const KIND_LABEL = {
  measured: 'Relevé',
  forecast: 'Prévision',
  computed: 'Calculé',
  simulated: 'Simulé',
} as const;

/**
 * Provenance d'un bloc de données, avec son heure de rafraîchissement.
 *
 * Handoff §5 : « la confiance se gagne en montrant la fraîcheur, pas en
 * promettant la précision ». Le champ `precision` dit explicitement ce que la
 * source ne sait PAS faire.
 */
export function DataSourceTag({
  source,
  refreshedAt,
  timeZone,
}: {
  source: SourceMeta;
  refreshedAt?: string;
  timeZone?: string;
}) {
  const formatted = refreshedAt
    ? new Intl.DateTimeFormat('fr-FR', {
        timeZone: timeZone ?? 'Europe/Paris',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(refreshedAt))
    : null;

  return (
    <p className="mt-3 font-mono text-[0.6875rem] leading-[1.5] text-fg-dim">
      <span className="uppercase tracking-[0.14em]">{KIND_LABEL[source.kind]}</span>
      {' · '}
      {source.name}
      {formatted ? ` · maj ${formatted}` : ''}
      <br />
      <span className="text-fg-dim">{source.precision}</span>
    </p>
  );
}
