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
    <p className="mt-3 meta font-mono leading-[1.5]">
      <span className="mr-1.5 inline-block rounded-tag bg-card-raised px-1.5 py-0.5 font-600 text-fg-muted">
        {KIND_LABEL[source.kind]}
      </span>
      {source.name}
      {formatted ? ` · maj ${formatted}` : ''}
      <br />
      <span className="text-fg-dim">{source.precision}</span>
    </p>
  );
}
