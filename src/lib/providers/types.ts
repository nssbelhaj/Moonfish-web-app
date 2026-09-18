import type {
  Catch,
  CatchInput,
  Favorite,
  MarinePoint,
  Outing,
  OutingInput,
  Profile,
  Spot,
  SpotReview,
  SpotReviewInput,
  TideEvent,
  WaitlistEntry,
  Visibility,
  WaitlistInput,
} from '@/data/schemas';

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
  /**
   * Nombre d'inscrits, ou `null` quand le dépôt n'a pas le DROIT de le savoir.
   *
   * Le dépôt MySQL est dans ce cas : AUCUN chemin de lecture n'existe sur la
   * table `waitlist` — un test échoue si un `select` y apparaît. C'est ce qui
   * empêche d'aspirer les adresses depuis l'application, et donc aussi de les
   * compter. Rendre `0` ferait passer une absence de droit pour une liste vide.
   */
  count(): Promise<number | null>;
  /** Uniquement pour les tests : la production n'a pas à relire la liste. */
  listForTests?(): Promise<WaitlistEntry[]>;
}

/* ────────────────────────────────────────────────────────────────────────────
   Contributions des pêcheurs : avis et prises déclarées.
   ──────────────────────────────────────────────────────────────────────────── */

/** Qui écrit. Le nom est recopié dans la ligne, voir la migration SQL. */
export interface Author {
  userId: string;
  displayName: string;
}

export type ContributionFailure =
  /** Les comptes ne sont pas ouverts sur ce déploiement. */
  | 'not-available'
  /** Session absente ou expirée. */
  | 'not-authenticated'
  /** Saisie refusée par le schéma. */
  | 'invalid'
  /** La base a refusé ou n'a pas répondu. */
  | 'storage-error';

export type ContributionResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: ContributionFailure; message: string };

/**
 * La note d'un spot, telle qu'on la lit en haut de sa page.
 *
 * ─── Pourquoi une requête à part, et pas les avis déjà chargés ────────────
 *
 * La moyenne doit porter sur TOUS les avis, pas sur la page qu'on affiche.
 * Calculée depuis `SpotContributions.reviews` — bornée à `PAGE_SIZE` — elle
 * serait juste tant qu'un spot a moins de cinquante avis, puis fausse sans
 * prévenir : exactement le genre de chiffre qui se dégrade en silence à
 * mesure que le site marche. C'est donc la base qui compte, avec un
 * `group by`, et la répartition vient du même passage.
 */
export interface SpotRating {
  /** Moyenne sur 5, `null` sans aucun avis — jamais 0, qui se lirait comme une mauvaise note. */
  average: number | null;
  count: number;
  /** Combien d'avis pour chaque note, de 1 à 5. Zéro inclus : une barre vide est une information. */
  breakdown: Record<1 | 2 | 3 | 4 | 5, number>;
}

export const NOTE_VIDE: SpotRating = {
  average: null,
  count: 0,
  breakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
};

/**
 * Les dernières contributions PUBLIQUES, tous spots confondus.
 *
 * ─── Pourquoi un point d'entrée à part ────────────────────────────────────
 *
 * La page d'accueil veut montrer ce que les pêcheurs déclarent ici, sans
 * savoir à l'avance sur quels spots. Le faire en appelant `forSpot` pour
 * chacun des spots du catalogue serait quarante requêtes pour en garder six —
 * et le tri par date se ferait en mémoire, donc faux dès que le site marche.
 *
 * Les prises rendues ici sont celles, et seulement celles, dont la visibilité
 * est `publique`. Le filtre est dans la REQUÊTE : une prise privée ne quitte
 * pas la base.
 */
export interface RecentContributions {
  catches: Catch[];
  reviews: SpotReview[];
}

export interface SpotContributions {
  reviews: SpotReview[];
  catches: Catch[];
  /** Moyenne des notes, `null` s'il n'y en a aucune — jamais 0, qui se lirait comme une mauvaise note. */
  averageRating: number | null;
  reviewCount: number;
}

/** Tout ce qu'un compte contient, pour l'export du droit d'accès. */
export interface AccountExport {
  exportedAt: string;
  account: { id: string; email: string | null };
  profile: Profile | null;
  reviews: SpotReview[];
  catches: Catch[];
  favorites: Favorite[];
  outings: Outing[];
  /*
    Les appareils enregistrés pour les notifications.

    Ils ne sont visibles nulle part ailleurs, et c'est précisément pourquoi
    ils doivent être ICI : le droit d'accès porte sur tout ce que nous
    détenons, pas sur ce que l'interface montre déjà. Un jeton de notification
    est une donnée rattachée à une personne et à un appareil ; l'omettre
    rendrait l'export incomplet sans que personne ne puisse s'en apercevoir.
  */
  devices: { token: string; platform: string; label: string | null }[];
}

/**
 * Une sortie dont l'alerte est à envoyer, avec l'adresse où l'envoyer.
 *
 * L'adresse est jointe ICI, par le dépôt, parce que c'est le seul endroit qui
 * a le droit de la lire : la tâche d'entretien ne fait que passer le message.
 */
export interface PendingAlert {
  outing: Outing;
  email: string;
}

export interface ContributionsRepository {
  /** `false` quand les comptes ne sont pas configurés : l'interface le DIT au lieu d'échouer. */
  readonly available: boolean;
  readonly source: SourceMeta;

  forSpot(spotSlug: string): Promise<SpotContributions>;
  /** Note agrégée d'un spot, comptée en base sur TOUS les avis. */
  ratingFor(spotSlug: string): Promise<SpotRating>;
  /**
   * Dernières contributions publiques, tous spots confondus, pour l'accueil.
   * `limite` borne CHAQUE liste, pas leur somme.
   */
  recentPublic(limite: number): Promise<RecentContributions>;
  /** Contributions d'une personne, pour son écran de compte. */
  listForUser(userId: string): Promise<{ reviews: SpotReview[]; catches: Catch[] }>;

  getProfile(userId: string): Promise<Profile | null>;
  createProfile(
    userId: string,
    displayName: string,
    /** Ce que le formulaire d'inscription a déjà collecté ailleurs ; ici, pour Google et le lien courriel. */
    complement?: { birthDate: string },
  ): Promise<ContributionResult<Profile>>;
  renameProfile(userId: string, displayName: string): Promise<ContributionResult<Profile>>;

  saveReview(input: SpotReviewInput, author: Author): Promise<ContributionResult<SpotReview>>;
  addCatch(input: CatchInput, author: Author): Promise<ContributionResult<Catch>>;

  /*
    Les suppressions exigent l'identifiant du PROPRIÉTAIRE, et ce n'est pas une
    commodité : c'est ce qui remplace la politique que PostgreSQL appliquait
    lui-même. MySQL ne connaît pas la sécurité au niveau des lignes ; la
    signature force donc l'appelant à dire au nom de qui il agit, et le
    compilateur refuse l'appel sans propriétaire.
  */
  deleteReview(reviewId: string, userId: string): Promise<ContributionResult<null>>;
  deleteCatch(catchId: string, userId: string): Promise<ContributionResult<null>>;

  /** Publier une prise, ou la reprendre. Le propriétaire est exigé, comme pour les suppressions. */
  setCatchVisibility(
    catchId: string,
    userId: string,
    visibility: Visibility,
  ): Promise<ContributionResult<null>>;

  /* ── Favoris ─────────────────────────────────────────────────────────── */

  listFavorites(userId: string): Promise<Favorite[]>;
  isFavorite(userId: string, spotSlug: string): Promise<boolean>;
  /** Idempotent : ajouter un favori déjà présent ne fait rien et ne se plaint pas. */
  addFavorite(userId: string, spotSlug: string): Promise<ContributionResult<null>>;
  removeFavorite(userId: string, spotSlug: string): Promise<ContributionResult<null>>;

  /* ── Sorties programmées ─────────────────────────────────────────────── */

  listOutings(userId: string): Promise<Outing[]>;
  addOuting(userId: string, input: OutingInput): Promise<ContributionResult<Outing>>;
  deleteOuting(outingId: string, userId: string): Promise<ContributionResult<null>>;

  /**
   * Sorties à venir dont l'alerte n'est pas encore partie, dans l'horizon
   * donné. La tâche d'entretien les prend, envoie, puis marque.
   */
  pendingAlerts(now: Date, horizonMs: number): Promise<PendingAlert[]>;
  /** Marque le courriel comme envoyé. Filtre sur le propriétaire, comme tout `update`. */
  markNotified(outingId: string, userId: string, at: Date): Promise<void>;

  /** Droit d'accès et de portabilité : tout ce que nous détenons, en une fois. */
  exportAccount(userId: string, email: string | null): Promise<ContributionResult<AccountExport>>;

  /** Droit à l'effacement. Supprime le compte ET, par cascade, ses contributions. */
  deleteAccount(userId: string): Promise<ContributionResult<null>>;
}
