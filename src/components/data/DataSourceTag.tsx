import { FreshnessChip } from './FreshnessChip';
import type { SourceStatus } from '@/lib/forecast';

const KIND_LABEL = {
  measured: 'Relevé',
  forecast: 'Prévision',
  computed: 'Calculé',
  simulated: 'Simulé',
} as const;

/**
 * Provenance d'un bloc de données, avec sa fraîcheur.
 *
 * Handoff §5 : « la confiance se gagne en montrant la fraîcheur, pas en
 * promettant la précision ». Le champ `precision` dit explicitement ce que la
 * source ne sait PAS faire, et la puce dit de quand date ce qui est affiché.
 *
 * La date affichée est celle rendue par le FOURNISSEUR. Elle valait auparavant
 * `generatedAt`, l'instant de rendu de la page : une table de marée servie
 * depuis un cache de vingt-quatre heures s'annonçait alors comme fraîche de la
 * minute.
 */
export function DataSourceTag({
  status,
  serverNow,
  timeZone,
}: {
  status: SourceStatus;
  /** Instant de rendu serveur, ISO. */
  serverNow: string;
  timeZone?: string;
}) {
  const { source, refreshedAt } = status;

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
    <p className="mt-3 text-meta text-fg-faint nums leading-[1.5]">
      <span className="mr-1.5 inline-block rounded-ctl bg-surface-2 px-1.5 py-0.5 font-600 text-fg">
        {KIND_LABEL[source.kind]}
      </span>
      {source.name}
      <br />
      <FreshnessChip source={source} refreshedAt={refreshedAt} serverNow={serverNow} />
      {formatted ? <span className="text-fg-faint"> · relevé le {formatted}</span> : null}
      <br />
      <span className="text-fg-faint">{source.precision}</span>
    </p>
  );
}
