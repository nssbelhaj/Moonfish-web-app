import type { Spot } from '@/data/schemas';

/**
 * « Marées réelles sur 3 spots : Pen Hat, La Torche, Étretat. Simulées sur
 * les 39 autres. » — la phrase qui manquait sous l'avertissement.
 *
 * Ne rend rien quand tout est réel (l'avertissement ne s'affiche pas) ni
 * quand tout est simulé (l'avertissement suffit) : elle n'existe que pour le
 * mélange, qui est le seul cas où l'avertissement seul induit en erreur.
 */
export function TideCoverageDetail({ real, simulated }: { real: readonly Spot[]; simulated: readonly Spot[] }) {
  if (real.length === 0 || simulated.length === 0) return null;

  const noms = real.map((spot) => spot.name);
  const liste = noms.length <= 5 ? noms.join(', ') : `${noms.slice(0, 5).join(', ')} et ${noms.length - 5} autres`;

  return (
    <>
      Marées <strong className="font-600 text-fg">réelles</strong> sur{' '}
      <span className="nums">{real.length}</span> spot{real.length > 1 ? 's' : ''} : {liste}.
      Simulées sur {simulated.length > 1 ? 'les' : 'le'}{' '}
      <span className="nums">{simulated.length}</span> autre{simulated.length > 1 ? 's' : ''} — c’est
      le réglage <code className="nums">TIDE_REAL_SPOTS</code>, pas une panne.
    </>
  );
}
