/**
 * Avertissement de données simulées.
 *
 * Non négociable : toute page affichant marée, vent ou houle le porte. Quelqu'un
 * peut consulter ce site en bord de mer et s'y fier — publier des horaires de
 * marée inventés sans le dire serait le seul vrai danger de cette version.
 *
 * Gabarit du handoff §5 : bordure 1 px pointillée + tag mono en tête de bloc.
 * Le jour où les données deviennent réelles, ce composant disparaît et
 * `DataSourceTag` occupe le même emplacement, au même gabarit.
 */
export function DemoDataNotice({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <p className="font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-score-mid">
        Données de démo
      </p>
    );
  }

  return (
    <aside className="demo-frame px-4 py-3" role="note">
      <p className="font-mono text-label uppercase tracking-[0.14em] text-score-mid">
        Données de démonstration
      </p>
      <p className="mt-2 text-body text-fg-muted">
        Les marées, le vent et la houle affichés sur cette page sont{' '}
        <strong className="font-600 text-fg">simulés</strong>. Ne les utilisez pas pour planifier
        une sortie réelle : consultez le SHOM pour les marées et Météo-France pour le bulletin
        marine.
      </p>
    </aside>
  );
}
