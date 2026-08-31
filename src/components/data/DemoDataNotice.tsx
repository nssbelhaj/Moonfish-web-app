import type { SourceMeta } from '@/lib/providers';

/**
 * Avertissement de données simulées.
 *
 * Piloté par les SOURCES et non écrit en dur : depuis le branchement
 * d'Open-Meteo, le vent et la houle sont réels tandis que la marée reste
 * simulée. Un avertissement figé mentirait désormais dans les deux sens —
 * en rassurant à tort sur la marée, et en dévaluant à tort la météo.
 *
 * Gabarit du handoff §5 : bordure 1 px pointillée + tag mono en tête de bloc.
 * Quand plus aucune source n'est simulée, le composant ne rend rien de
 * lui-même : il n'y a rien à retirer à la main.
 */
export function simulatedSources(sources: readonly SourceMeta[]): SourceMeta[] {
  return sources.filter((source) => source.kind === 'simulated');
}

/**
 * Ce que recouvre chaque source, avec son genre grammatical : « les marées sont
 * simulées » mais « le vent et la houle sont simulés ». En cas de mélange, le
 * masculin pluriel s'impose, ce qui est la règle.
 */
function subjectOf(source: SourceMeta): { noun: string; feminine: boolean } {
  const name = source.name.toLowerCase();
  if (name.includes('marée')) return { noun: 'les marées', feminine: true };
  if (name.includes('météo') || name.includes('repli')) {
    return { noun: 'le vent et la houle', feminine: false };
  }
  return { noun: 'certaines données', feminine: true };
}

export function DemoDataNotice({
  sources,
  compact = false,
}: {
  sources: readonly SourceMeta[];
  compact?: boolean;
}) {
  const simulated = simulatedSources(sources);
  if (simulated.length === 0) return null;

  if (compact) {
    return (
      <p className="font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-score-mid">
        Données de démo
      </p>
    );
  }

  const subjects = simulated.map(subjectOf);
  const nouns = [...new Set(subjects.map((subject) => subject.noun))];
  const list =
    nouns.length === 1 ? nouns[0] : `${nouns.slice(0, -1).join(', ')} et ${nouns[nouns.length - 1]}`;
  const verb = subjects.every((subject) => subject.feminine) ? 'sont simulées' : 'sont simulés';

  return (
    <aside className="demo-frame px-4 py-3" role="note">
      <p className="font-mono text-label uppercase tracking-[0.14em] text-score-mid">
        Données de démonstration
      </p>
      <p className="mt-2 text-body text-fg-muted">
        Sur cette page, <strong className="font-600 text-fg">{list}</strong> {verb}. Ne vous en
        servez pas pour planifier une sortie réelle : consultez{' '}
        <a
          href="https://maree.shom.fr"
          className="underline decoration-dotted underline-offset-4"
          rel="noopener noreferrer"
          target="_blank"
        >
          le SHOM
        </a>{' '}
        pour les horaires officiels.
      </p>
    </aside>
  );
}
