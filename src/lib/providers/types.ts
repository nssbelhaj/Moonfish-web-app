import type { MarinePoint, Spot, TideEvent, WaitlistEntry, WaitlistInput } from '@/data/schemas';

export interface DateRange {
  from: Date;
  /** Borne exclusive. */
  to: Date;
}

/**
 * Nature de la donnée, affichée telle quelle par `DataSourceTag`.
 *
 * La distinction n'est pas décorative : seul `simulated` déclenche le cadre
 * pointillé et l'avertissement. Publier une heure de marée inventée sans le dire
 * est le seul vrai risque produit de cette version.
 *
 *  - `measured`   relevé ou contenu éditorial vérifié ;
 *  - `forecast`   sortie d'un modèle météo réel — vraie donnée, mais dont la
 *                 fiabilité décroît avec l'échéance, ce qu'il faut dire ;
 *  - `computed`   calculé localement par une formule déterministe (astronomie) ;
 *  - `simulated`  inventé.
 */
export type DataKind = 'measured' | 'forecast' | 'computed' | 'simulated';

export interface SourceMeta {
  /** Nom lisible de la source, tel qu'affiché à l'utilisateur. */
  name: string;
  kind: DataKind;
  /** Précision revendiquée, en une phrase. Jamais de fausse précision. */
  precision: string;
  /** Lien vers la source, quand elle est publique. */
  url?: string;
}

/** Enveloppe systématique : aucune donnée ne circule sans sa provenance. */
export interface Sourced<T> {
  data: T;
  source: SourceMeta;
  /** Horodatage ISO de la production de cette donnée. */
  refreshedAt: string;
}

export interface TideProvider {
  readonly source: SourceMeta;
  /** Pleines et basses mers couvrant l'intervalle demandé. */
  getTideEvents(spot: Spot, range: DateRange): Promise<Sourced<TideEvent[]>>;
}

export interface WeatherProvider {
  readonly source: SourceMeta;
  /** Série horaire de conditions marines couvrant l'intervalle demandé. */
  getMarineSeries(spot: Spot, range: DateRange): Promise<Sourced<MarinePoint[]>>;
}

export interface SpotRepository {
  readonly source: SourceMeta;
  list(): Promise<Spot[]>;
  findBySlug(slug: string): Promise<Spot | null>;
  /** Résolution depuis l'URL `/spots/[country]/[region]/[slug]`. */
  findByPath(countrySlug: string, regionSlug: string, slug: string): Promise<Spot | null>;
}

export type WaitlistResult =
  | { ok: true; alreadyRegistered: boolean }
  | { ok: false; reason: 'invalid' | 'rate-limited' | 'storage-error' };

export interface WaitlistRepository {
  readonly source: SourceMeta;
  add(input: WaitlistInput, context: { ip: string }): Promise<WaitlistResult>;
  count(): Promise<number>;
  /** Uniquement pour les tests : la production n'a pas à relire la liste. */
  listForTests?(): Promise<WaitlistEntry[]>;
}
