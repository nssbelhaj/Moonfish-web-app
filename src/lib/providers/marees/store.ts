import type { TideExtreme } from '@/lib/forecast/tide-coefficient';

/**
 * Une table de marée conservée : les extremums d'un point sur une fenêtre.
 *
 * `pointSlug` est le slug d'un spot, ou `brest` — le coefficient français est
 * défini sur le marnage de Brest, et il faut sa table pour calculer celui de
 * n'importe quel spot.
 *
 * Les bornes sont OBSERVÉES : ce sont celles des extremums réellement rendus,
 * pas celles demandées au fournisseur. Si le fournisseur rend moins, la ligne
 * le dit — et la couverture insuffisante déclenche un rafraîchissement plus
 * tôt, au lieu de laisser des journées sans marée.
 */
export interface TableDeMaree {
  pointSlug: string;
  /** ISO. */
  coversFrom: string;
  /** ISO, inclus (dernier extremum rendu). */
  coversTo: string;
  extremes: TideExtreme[];
  sourceName: string;
  /** ISO. */
  fetchedAt: string;
}

/** Slug réservé à la table nationale de Brest. */
export const POINT_BREST = 'brest';

export interface TideTableStore {
  lire(pointSlug: string): Promise<TableDeMaree | null>;
  ecrire(table: TableDeMaree): Promise<void>;
  /** Toutes les tables, pour l'entretien et le diagnostic. */
  toutes(): Promise<TableDeMaree[]>;
  /**
   * Exécute `fn` en étant SEUL sur ce point.
   *
   * ─── La panne que ça évite ─────────────────────────────────────────────
   *
   * Le build rend des dizaines de pages en parallèle, sur plusieurs
   * processus. Sur une base neuve, tous manquent la table de Brest au même
   * instant, tous la demandent : huit requêtes pour la même table, le
   * budget du jour parti avant le premier spot. Mesuré, pas supposé.
   *
   * Sous ce verrou, le premier demande, les autres attendent puis relisent
   * la table qu'il vient d'écrire. Un verrou en base vaut pour tous les
   * processus ; en mémoire, pour un seul — c'est ce que chaque magasin peut
   * garantir, et pas plus.
   */
  verrou<T>(pointSlug: string, fn: () => Promise<T>): Promise<T>;
}

/**
 * Magasin en mémoire — pour les tests, et pour un serveur sans base.
 *
 * Sans base, il vaut mieux que rien : le cache de `fetch` de Next mourait à
 * chaque build, celui-ci survit au moins le temps du processus.
 */
export class MemoryTideTableStore implements TideTableStore {
  private readonly tables = new Map<string, TableDeMaree>();
  /** Une file par point : les appels s'enchaînent, jamais en parallèle. */
  private readonly files = new Map<string, Promise<unknown>>();

  async lire(pointSlug: string): Promise<TableDeMaree | null> {
    const table = this.tables.get(pointSlug);
    return table ? structuredClone(table) : null;
  }

  async ecrire(table: TableDeMaree): Promise<void> {
    this.tables.set(table.pointSlug, structuredClone(table));
  }

  async toutes(): Promise<TableDeMaree[]> {
    return [...this.tables.values()].map((table) => structuredClone(table));
  }

  verrou<T>(pointSlug: string, fn: () => Promise<T>): Promise<T> {
    const precedent = this.files.get(pointSlug) ?? Promise.resolve();
    // L'échec du précédent ne doit pas bloquer le suivant : on l'avale ICI,
    // il a déjà été rendu à son propre appelant.
    const suivant = precedent.catch(() => undefined).then(fn);
    this.files.set(pointSlug, suivant);
    return suivant;
  }
}
