/**
 * Regroupement des marqueurs qui se recouvrent, à une échelle donnée.
 *
 * ─── Pourquoi regrouper plutôt qu'écarter ──────────────────────────────────
 *
 * La première carte ÉCARTAIT les marqueurs trop proches : à quarante-deux
 * spots, cela donnait une grappe de pastilles serrées sur toute la côte, où
 * plus rien ne se lisait — et qui se resserrait encore en zoomant, puisque
 * chaque zoom recommençait à repousser. Écarter garde tout visible ; c'est
 * précisément le problème quand tout ne PEUT pas être visible.
 *
 * Regrouper dit la vérité de l'échelle : à cette distance, il y a « six spots
 * ici », et c'est en s'approchant qu'on les distingue. Une pastille chiffrée
 * remplace six pastilles illisibles, et un clic dessus zoome jusqu'à ce
 * qu'elles se séparent.
 *
 * ─── Pur, en pixels, sans Leaflet ──────────────────────────────────────────
 *
 * La fonction reçoit des coordonnées déjà projetées et ne connaît ni la carte
 * ni le DOM : elle se teste en une milliseconde, et le composant n'a qu'à la
 * rappeler à chaque changement de zoom. Le regroupement ne dépend PAS du
 * déplacement : à zoom égal, deux points sont à la même distance en pixels
 * où que soit le cadre, donc on projette en coordonnées de calque, pas de
 * conteneur.
 */

export interface PointPixel {
  x: number;
  y: number;
}

export interface Groupe {
  /** Barycentre des membres, en pixels. */
  x: number;
  y: number;
  /** Indices dans le tableau d'entrée, dans l'ordre d'entrée. */
  membres: number[];
}

/**
 * Regroupe les points à moins de `rayon` pixels les uns des autres.
 *
 * Glouton en deux passes : la première rattache chaque point au premier
 * groupe assez proche, la seconde fusionne les groupes dont les centres se
 * sont rapprochés en dérivant. Ce n'est pas optimal au sens mathématique, et
 * ce n'est pas le but : il faut que deux pastilles ne se chevauchent jamais,
 * et qu'un même jeu de points donne toujours le même résultat.
 */
export function regrouper(points: readonly PointPixel[], rayon: number): Groupe[] {
  const groupes: Groupe[] = [];
  const r2 = rayon * rayon;

  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (p === undefined) continue;

    let cible: Groupe | null = null;
    let meilleure = Infinity;
    for (const g of groupes) {
      const d2 = (g.x - p.x) ** 2 + (g.y - p.y) ** 2;
      if (d2 < r2 && d2 < meilleure) {
        meilleure = d2;
        cible = g;
      }
    }

    if (cible === null) {
      groupes.push({ x: p.x, y: p.y, membres: [i] });
    } else {
      const n = cible.membres.length;
      cible.x = (cible.x * n + p.x) / (n + 1);
      cible.y = (cible.y * n + p.y) / (n + 1);
      cible.membres.push(i);
    }
  }

  // Seconde passe : deux groupes dont les centres ont dérivé l'un vers
  // l'autre se chevaucheraient. On les fond, du plus peuplé au moins peuplé.
  const fusionnes: Groupe[] = [];
  for (const g of [...groupes].sort((a, b) => b.membres.length - a.membres.length)) {
    const hote = fusionnes.find((h) => (h.x - g.x) ** 2 + (h.y - g.y) ** 2 < r2);
    if (hote === undefined) {
      fusionnes.push({ x: g.x, y: g.y, membres: [...g.membres] });
    } else {
      const n = hote.membres.length;
      const m = g.membres.length;
      hote.x = (hote.x * n + g.x * m) / (n + m);
      hote.y = (hote.y * n + g.y * m) / (n + m);
      hote.membres.push(...g.membres);
    }
  }

  for (const g of fusionnes) g.membres.sort((a, b) => a - b);
  return fusionnes.sort((a, b) => (a.membres[0] ?? 0) - (b.membres[0] ?? 0));
}
