import type { ReactNode } from 'react';

/**
 * État vide d'une liste.
 *
 * ─── Un compte neuf n'est pas un compte en panne ──────────────────────────
 *
 * Les cinq listes du compte s'ouvrent vides, et elles le disaient chacune à
 * sa façon : un paragraphe gris ici, un cadre d'avertissement là — le même
 * cadre pointillé qui, ailleurs sur le site, signale des données simulées.
 * Une personne qui vient de s'inscrire voyait donc quatre alertes.
 *
 * Un état vide dit deux choses, et seulement deux : ce qui manque, et le
 * geste qui le remplit. Jamais un reproche, jamais un ton d'erreur.
 */
export function Vide({
  titre,
  children,
  action,
}: {
  titre: string;
  children: ReactNode;
  /** Le geste qui remplit le vide. Omis quand il n'y en a pas d'immédiat. */
  action?: ReactNode;
}) {
  return (
    <div className="vide">
      <p className="vide-titre">{titre}</p>
      <p className="vide-texte">{children}</p>
      {action !== undefined && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
