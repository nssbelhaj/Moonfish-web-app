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
  /**
   * `true` quand cette source est un REPLI après échec du fournisseur réel,
   * par opposition à un fournisseur simulé délibérément configuré.
   *
   * Les deux rendent `kind: 'simulated'`, mais ils ne veulent pas dire la même
   * chose : le premier est une panne à signaler, le second le mode démo normal.
   * Sans cette distinction, une démo hors ligne afficherait un voyant d'alerte
   * permanent — et le jour d'une vraie panne, plus personne ne le regarderait.
   */
  degraded?: boolean;
  /**
   * Durée pendant laquelle cette source reste « à jour », en heures.
   * `null` = ne périme pas. Omis = valeur par défaut de son `kind`.
   *
   * La péremption est une propriété de la SOURCE, pas de sa nature. Marées et
   * météo sont toutes deux des `forecast`, et pourtant : une prévision de vent
   * est révisée plusieurs fois par jour, une table de marée est de l'astronomie
   * prédite des mois à l'avance. Les ranger sous un même seuil affichait
   * « à jour pendant 6 h » sur un bloc dont le texte disait, deux lignes plus
   * haut, qu'un cache de 24 à 72 h ne lui fait rien perdre.
   */
  validityHours?: number | null;
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
