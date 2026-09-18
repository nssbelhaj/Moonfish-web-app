import type { MarinePoint, Spot, TideEvent } from '@/data/schemas';
import type { ForecastDay, ForecastSlot, SpotForecast, SourceStatus } from '@/lib/forecast';
import type { SafetyLevel, ScoreFactor, ScoreLabel } from '@/lib/scoring';
import type { DataKind } from '@/lib/providers';
import type { SpotContributions } from '@/lib/providers/types';
import type { CatchLogSummary } from '@/lib/contributions/catch-log';
import type { Catch, Visibility } from '@/data/schemas';
import { photoUrl } from '@/lib/photo/url';
import { absoluteUrl } from '@/lib/routes';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  La frontière : du domaine vers le JSON public
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ── Les noms de champs sont ceux du domaine, en anglais, volontairement ──
 *
 * Tout le reste du projet s'écrit en français, ce module compris — mais les
 * NOMS DE CHAMPS restent ceux de `src/data/schemas.ts` (`windSpeedKmh`,
 * `spotSlug`, `heightM`…). C'est le vocabulaire de données déjà établi, celui
 * que les schémas Zod valident et que la base porte. Les traduire ici
 * créerait un dictionnaire de plus à tenir à jour, et la première fois qu'on
 * oublierait de le mettre à jour, l'application recevrait un champ absent
 * sans que rien ne le signale. Une correspondance de un pour un se relit ;
 * une traduction se périme.
 *
 * ── LA transformation de ce module : la sécurité sort du score ───────────
 *
 * `ScoreResult` porte `safety` À L'INTÉRIEUR de lui. C'est commode en
 * mémoire, et c'est exactement ce qu'il ne faut pas publier : un client qui
 * reçoit la sécurité comme une propriété du score finira par la traiter comme
 * une conséquence du score — par l'afficher à côté, par la masquer quand le
 * score est bon, par l'oublier quand le score est absent.
 *
 * Dans le JSON, `safety` est donc un FRÈRE de `score`, au niveau du créneau,
 * et l'objet `score` publié ne contient plus de `safety` du tout. La règle
 * « houle > 2,5 m ou vent > 50 km/h ⇒ danger » est évaluée par
 * `lib/scoring/safety.ts`, jamais dérivée du `breakdown` ; la forme du JSON
 * rend cette indépendance visible, et `securite-hors-score.test.ts` fait
 * échouer le build si quelqu'un la remet dedans.
 *
 * ── `sources` voyage avec les données, sans exception ────────────────────
 *
 * Une prévision sans sa provenance est la panne que ce projet refuse depuis
 * le début : l'application doit pouvoir écrire « marée simulée » exactement
 * là où le site l'écrit. `sources` n'est donc pas optionnel dans le type, et
 * un test vérifie qu'aucune réponse de prévision n'en sort dépourvue.
 */

/* ── Sources ───────────────────────────────────────────────────────────── */

export interface SourceJson {
  name: string;
  kind: DataKind;
  precision: string;
  url: string | null;
  /** `true` seulement après ÉCHEC d'un fournisseur réel — pas en mode démo choisi. */
  degraded: boolean;
  /** Heures de validité, `null` si la donnée ne périme pas. */
  validityHours: number | null;
  /** Horodatage rendu par le FOURNISSEUR, jamais celui du rendu. */
  refreshedAt: string | null;
}

/**
 * Validité par défaut d'une nature de donnée.
 *
 * Recopiée de `SourceMeta.validityHours`, dont l'omission signifie « le
 * défaut de son `kind` ». L'application hors ligne doit pouvoir dire « pas
 * rafraîchie depuis » sans connaître ces défauts : on les résout ici, une
 * fois, plutôt que de laisser chaque client les redeviner.
 */
const VALIDITE_PAR_DEFAUT: Record<DataKind, number | null> = {
  measured: 6,
  forecast: 6,
  computed: null,
  simulated: null,
};

export function sourceEnJson(statut: SourceStatus): SourceJson {
  const { source } = statut;

  return {
    name: source.name,
    kind: source.kind,
    precision: source.precision,
    url: source.url ?? null,
    degraded: source.degraded ?? false,
    validityHours:
      source.validityHours === undefined ? VALIDITE_PAR_DEFAUT[source.kind] : source.validityHours,
    refreshedAt: statut.refreshedAt,
  };
}

export interface SourcesJson {
  tide: SourceJson;
  weather: SourceJson;
  astro: SourceJson;
}

/* ── Score et sécurité ─────────────────────────────────────────────────── */

export interface FacteurJson {
  /** Sous-score 0–10, `null` quand la source manque. JAMAIS 0. */
  score: number | null;
  /** Poids effectif après renormalisation. */
  weight: number;
  nominalWeight: number;
  note: string;
}

/** Le score publié. Il ne porte PAS la sécurité : voir l'en-tête du module. */
export interface ScoreJson {
  value: number | null;
  label: ScoreLabel | null;
  coverage: number;
  reasons: string[];
  breakdown: Record<ScoreFactor, FacteurJson>;
}

export interface SecuriteJson {
  level: SafetyLevel;
  message: string | null;
}

export interface CreneauJson {
  start: string;
  end: string;
  score: ScoreJson;
  /** Frère de `score`, jamais son enfant. */
  safety: SecuriteJson;
  conditions: MarinePoint | null;
  tide: ForecastSlot['tide'];
  lightPhase: ForecastSlot['lightPhase'];
}

export function creneauEnJson(creneau: ForecastSlot): CreneauJson {
  /*
    Déstructuration explicite plutôt qu'un `...creneau.score` : elle fait
    tomber `safety` du score publié PAR CONSTRUCTION. Un étalement aurait
    recopié tout ce que `ScoreResult` gagnera un jour, sécurité comprise, sans
    que personne ne s'en aperçoive.
  */
  const { value, label, coverage, reasons, breakdown, safety } = creneau.score;

  return {
    start: creneau.start,
    end: creneau.end,
    score: { value, label, coverage, reasons, breakdown },
    safety: { level: safety.level, message: safety.message ?? null },
    conditions: creneau.conditions,
    tide: creneau.tide,
    lightPhase: creneau.lightPhase,
  };
}

/* ── Jours et prévision ────────────────────────────────────────────────── */

export interface JourJson {
  date: string;
  slots: CreneauJson[];
  sunrise: string | null;
  sunset: string | null;
  /** `null` est une VALEUR : la Lune saute une journée civile deux fois par mois. */
  moonrise: string | null;
  moonset: string | null;
  tideEvents: TideEvent[];
  moonIlluminationPct: number;
  moonAgeDays: number;
  moonWaxing: boolean;
  best: CreneauJson | null;
}

export function jourEnJson(jour: ForecastDay): JourJson {
  return {
    date: jour.date,
    slots: jour.slots.map(creneauEnJson),
    sunrise: jour.sunrise,
    sunset: jour.sunset,
    moonrise: jour.moonrise,
    moonset: jour.moonset,
    tideEvents: jour.tideEvents,
    moonIlluminationPct: jour.moonIlluminationPct,
    moonAgeDays: jour.moonAgeDays,
    moonWaxing: jour.moonWaxing,
    best: jour.best === null ? null : creneauEnJson(jour.best),
  };
}

export interface PrevisionJson {
  spot: Spot;
  generatedAt: string;
  days: JourJson[];
  tideEvents: TideEvent[];
  current: CreneauJson | null;
  best: CreneauJson | null;
  nextGood: CreneauJson | null;
  /** Obligatoire. Une donnée qui circule sans sa provenance est un défaut. */
  sources: SourcesJson;
}

export function previsionEnJson(prevision: SpotForecast): PrevisionJson {
  return {
    spot: prevision.spot,
    generatedAt: prevision.generatedAt,
    days: prevision.days.map(jourEnJson),
    tideEvents: prevision.tideEvents,
    current: prevision.current === null ? null : creneauEnJson(prevision.current),
    best: prevision.best === null ? null : creneauEnJson(prevision.best),
    nextGood: prevision.nextGood === null ? null : creneauEnJson(prevision.nextGood),
    sources: {
      tide: sourceEnJson(prevision.sources.tide),
      weather: sourceEnJson(prevision.sources.weather),
      astro: sourceEnJson(prevision.sources.astro),
    },
  };
}

/* ── Contributions ─────────────────────────────────────────────────────── */

/**
 * Une prise telle que l'API la publie.
 *
 * `photoPath` devient `photoUrl` : le chemin dans le stockage n'est pas
 * l'affaire du client, et le publier lui apprendrait la façon dont les
 * fichiers sont rangés sur le serveur. L'URL passe par `/api/photos/...`,
 * notre propre origine, qui vérifie le chemin avant de servir.
 *
 * Elle est ABSOLUE, contrairement à celle du site. Une application n'a pas
 * d'origine contre laquelle résoudre « /api/photos/… » : lui envoyer un
 * chemin relatif lui donnerait une image qui ne se charge jamais, sans
 * erreur visible — juste un cadre vide.
 */
export interface PriseJson {
  id: string;
  spotSlug: string;
  authorName: string;
  species: string;
  lengthCm: number | null;
  weightG: number | null;
  released: boolean;
  caughtAt: string;
  note: string | null;
  photoUrl: string | null;
  createdAt: string;
}

export interface ContributionsJson {
  reviews: {
    id: string;
    spotSlug: string;
    authorName: string;
    rating: number;
    comment: string | null;
    createdAt: string;
    updatedAt: string;
  }[];
  catches: PriseJson[];
  /** `null` s'il n'y a aucun avis — jamais 0, qui se lirait comme une mauvaise note. */
  averageRating: number | null;
  reviewCount: number;
}

/**
 * Contributions publiques d'un spot.
 *
 * `userId` ne sort PAS. Il n'a aucun usage côté application — le nom affiché
 * suffit à signer — et le publier permettrait de recouper toutes les
 * contributions d'une même personne à travers le catalogue, ce que la page de
 * confidentialité ne prévoit pas.
 */
export function contributionsEnJson(contributions: SpotContributions): ContributionsJson {
  return {
    reviews: contributions.reviews.map((avis) => ({
      id: avis.id,
      spotSlug: avis.spotSlug,
      authorName: avis.authorName,
      rating: avis.rating,
      comment: avis.comment,
      createdAt: avis.createdAt,
      updatedAt: avis.updatedAt,
    })),
    catches: contributions.catches.map(priseEnJson),
    averageRating: contributions.averageRating,
    reviewCount: contributions.reviewCount,
  };
}

export function priseEnJson(prise: {
  id: string;
  spotSlug: string;
  authorName: string;
  species: string;
  lengthCm: number | null;
  weightG: number | null;
  released: boolean;
  caughtAt: string;
  note: string | null;
  photoPath: string | null;
  createdAt: string;
}): PriseJson {
  return {
    id: prise.id,
    spotSlug: prise.spotSlug,
    authorName: prise.authorName,
    species: prise.species,
    lengthCm: prise.lengthCm,
    weightG: prise.weightG,
    released: prise.released,
    caughtAt: prise.caughtAt,
    note: prise.note,
    photoUrl: urlAbsolueDePhoto(prise.photoPath),
    createdAt: prise.createdAt,
  };
}

/** Chemin de stockage → URL absolue, ou `null` s'il n'y a pas de photo. */
function urlAbsolueDePhoto(chemin: string | null): string | null {
  const relative = photoUrl(chemin);
  return relative === null ? null : absoluteUrl(relative);
}

/**
 * Une prise DU CARNET, c'est-à-dire vue par son auteur.
 *
 * Elle porte en plus sa `visibility`, que la vue publique n'a évidemment pas
 * à donner. C'est ce qui permet à l'écran Carnet d'afficher le bouton
 * « publier » dans le bon état — une prise est privée par défaut, et son
 * auteur seul décide de la montrer.
 */
export interface PriseCarnetJson extends PriseJson {
  visibility: Visibility;
}

export function priseDuCarnetEnJson(prise: Catch): PriseCarnetJson {
  return { ...priseEnJson(prise), visibility: prise.visibility };
}

/* ── Résumé du carnet ──────────────────────────────────────────────────── */

/**
 * Le résumé du carnet, sérialisé.
 *
 * ═══ UN DÉFAUT TROUVÉ EN ÉCRIVANT LE CLIENT MOBILE ═══
 *
 * `summarizeCatches` rend des `Catch` du DOMAINE — avec `userId` et
 * `photoPath`. Ils partaient tels quels dans `catchLog.longest`, alors que
 * toutes les autres prises de la même réponse passaient par `priseEnJson`.
 * L'identifiant de compte et le chemin de stockage sortaient donc du serveur
 * par cette seule porte, à côté de trois autres correctement fermées.
 *
 * Ce n'est pas une fuite entre personnes — c'est son propre carnet — mais
 * c'est une rupture du contrat annoncé, et la sorte de chose qui devient une
 * vraie fuite le jour où quelqu'un réutilise ce champ ailleurs. Le trou s'est
 * vu en écrivant le schéma Zod du client : il attendait `photoUrl` et
 * recevait `photoPath`.
 */
export interface CarnetJson extends Omit<CatchLogSummary, 'longest' | 'first' | 'last'> {
  longest: PriseCarnetJson | null;
  first: PriseCarnetJson | null;
  last: PriseCarnetJson | null;
}

export function carnetEnJson(resume: CatchLogSummary): CarnetJson {
  return {
    ...resume,
    longest: resume.longest === null ? null : priseDuCarnetEnJson(resume.longest),
    first: resume.first === null ? null : priseDuCarnetEnJson(resume.first),
    last: resume.last === null ? null : priseDuCarnetEnJson(resume.last),
  };
}
