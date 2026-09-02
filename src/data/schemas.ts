import { z } from 'zod';

/**
 * Schémas du domaine.
 *
 * Ils décrivent la forme que prendront les VRAIES réponses des fournisseurs,
 * pas la commodité des mocks actuels. Concrètement :
 *  - `TideEvent` correspond à un élément de `tide/extremes/point` chez Stormglass
 *    (`time`, `type`, `height`), enrichi du coefficient français ;
 *  - `MarinePoint` est l'aplatissement d'une heure d'Open-Meteo Marine +
 *    Open-Meteo Forecast, dont les réponses arrivent en tableaux parallèles ;
 *  - `Spot` est ce qu'une table `spots` renverra pour une ligne, le jour où
 *    les spots quitteront le fichier.
 *
 * Le jour du branchement, seul l'adaptateur change : ces schémas restent la
 * frontière et `safeParse` reste le garde-fou.
 */

export const isoDateTime = z.string().datetime({ offset: true });

export const spotExposureSchema = z.enum(['abrite', 'semi-abrite', 'expose', 'tres-expose']);
export const spotBottomSchema = z.enum(['sable', 'sable-roche', 'roche', 'galets', 'vase-estuaire']);
export const spotTypeSchema = z.enum(['plage', 'estran-rocheux', 'pointe', 'estuaire', 'digue']);

/**
 * Techniques praticables depuis le bord sur un spot.
 *
 * Moonfish ne parle pas que de surfcasting : un estran rocheux se pêche au
 * rockfishing ou au shore-jigging, un estran sableux découvrant se pêche aussi
 * à pied. La technique dépend du fond, de l'exposition et de l'accès — elle est
 * donc une propriété du spot, pas une préférence de l'utilisateur.
 */
export const fishingTechniqueSchema = z.enum([
  'surfcasting',
  'lancer-ramener',
  'rockfishing',
  'shore-jigging',
  'peche-a-soutenir',
  'peche-au-flotteur',
  'peche-a-pied',
]);

export const spotSchema = z.object({
  /** Slug sans accent, stable, utilisé dans l'URL. */
  slug: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(2),
  countrySlug: z.string().regex(/^[a-z0-9-]+$/),
  countryName: z.string().min(2),
  regionSlug: z.string().regex(/^[a-z0-9-]+$/),
  regionName: z.string().min(2),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  /** Fuseau IANA, nécessaire pour afficher des horaires locaux justes. */
  timezone: z.string().min(3),
  /** Cap de la plage vers le large, en degrés. */
  facingDeg: z.number().min(0).max(359),
  exposure: spotExposureSchema,
  bottom: spotBottomSchema,
  type: spotTypeSchema,
  /** Techniques réellement praticables depuis le bord, de la plus courante à la plus occasionnelle. */
  techniques: z.array(fishingTechniqueSchema).min(1),
  /** Espèces cibles, de la plus régulière à la plus occasionnelle. */
  species: z.array(z.string().min(2)).min(2),
  /** Marnage moyen en mètres — sert à mettre à l'échelle les hauteurs d'eau. */
  meanTideRangeM: z.number().min(0).max(15),
  summary: z.string().min(40),
  access: z.string().min(20),
});

export type Spot = z.infer<typeof spotSchema>;
export type SpotExposure = z.infer<typeof spotExposureSchema>;
export type SpotBottom = z.infer<typeof spotBottomSchema>;
export type SpotType = z.infer<typeof spotTypeSchema>;
export type FishingTechnique = z.infer<typeof fishingTechniqueSchema>;

export const tideEventSchema = z.object({
  time: isoDateTime,
  type: z.enum(['high', 'low']),
  heightM: z.number(),
  /** Coefficient de marée, échelle française 20–120. */
  coefficient: z.number().min(20).max(120),
});

export type TideEvent = z.infer<typeof tideEventSchema>;

/**
 * Une heure de conditions marines.
 *
 * Les cinq champs d'affichage sont NULLABLES parce qu'une vraie API en renvoie
 * des trous : Open-Meteo ne couvre pas la température de surface partout, et
 * les rafales manquent sur certaines mailles. L'interface affiche alors
 * « Indispo. » — jamais 0, qui serait une valeur (handoff §5).
 *
 * Les cinq champs dont le score dépend, eux, restent obligatoires : une heure
 * sans vent ni houle n'est pas une heure dégradée, c'est une heure absente, et
 * elle est écartée en amont plutôt que comblée.
 */
export const marinePointSchema = z.object({
  time: isoDateTime,
  windSpeedKmh: z.number().min(0),
  /** Direction D'OÙ VIENT le vent (convention marine). */
  windFromDeg: z.number().min(0).max(360),
  swellHeightM: z.number().min(0),
  swellPeriodS: z.number().min(0),
  swellFromDeg: z.number().min(0).max(360),
  windGustKmh: z.number().min(0).nullable(),
  airTempC: z.number().nullable(),
  waterTempC: z.number().nullable(),
  cloudCoverPct: z.number().min(0).max(100).nullable(),
  pressureHpa: z.number().min(870).max(1090).nullable(),
  /**
   * Champs de confort et de sécurité, tous facultatifs.
   *
   * Ils viennent du MÊME appel Open-Meteo que le reste : les demander ne coûte
   * rien de plus. Ils sont nullables parce qu'aucun n'est nécessaire au score —
   * leur absence ne doit jamais faire tomber une heure.
   */
  precipitationProbabilityPct: z.number().min(0).max(100).nullable().default(null),
  uvIndex: z.number().min(0).max(20).nullable().default(null),
  visibilityKm: z.number().min(0).max(200).nullable().default(null),
  apparentTempC: z.number().min(-90).max(70).nullable().default(null),
  humidityPct: z.number().min(0).max(100).nullable().default(null),
  dewPointC: z.number().min(-90).max(60).nullable().default(null),
});

export type MarinePoint = z.infer<typeof marinePointSchema>;

export const waitlistEntrySchema = z.object({
  email: z.string().email().max(254),
  /** D'où vient l'inscription : utile pour mesurer quelle page convertit. */
  source: z.string().max(64).default('site'),
  createdAt: isoDateTime,
});

export type WaitlistEntry = z.infer<typeof waitlistEntrySchema>;

/** Ce que le formulaire envoie ; `createdAt` et l'IP sont posés côté serveur. */
export const waitlistInputSchema = z.object({
  email: z
    .string({ required_error: 'Renseignez une adresse e-mail.' })
    .trim()
    .min(3, 'Adresse trop courte.')
    .max(254, 'Adresse trop longue.')
    .email('Cette adresse e-mail n’est pas valide.'),
  source: z.string().trim().max(64).optional(),
});

export type WaitlistInput = z.infer<typeof waitlistInputSchema>;

/* ────────────────────────────────────────────────────────────────────────────
   Contributions : profils, avis et prises déclarées.

   Ces schémas sont la FRONTIÈRE de confiance : tout ce qui vient d'un
   formulaire ou de la base y passe. Les bornes reprennent exactement celles
   des contraintes SQL de `db/migrations/0001_comptes_et_contributions.sql`
   — un écart ferait rejeter par la base ce que le formulaire a accepté, avec
   une erreur technique en pleine figure de l'utilisateur.
   ──────────────────────────────────────────────────────────────────────────── */

export const displayNameSchema = z
  .string({ required_error: 'Choisissez un nom affiché.' })
  .trim()
  .min(2, 'Deux caractères au minimum.')
  .max(40, 'Quarante caractères au maximum.');

export const profileSchema = z.object({
  id: z.string().uuid(),
  displayName: displayNameSchema,
  consentVersion: z.string(),
  consentAt: isoDateTime,
  createdAt: isoDateTime,
});

export type Profile = z.infer<typeof profileSchema>;

export const spotReviewSchema = z.object({
  id: z.string().uuid(),
  spotSlug: z.string(),
  userId: z.string().uuid(),
  authorName: z.string(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().nullable(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});

export type SpotReview = z.infer<typeof spotReviewSchema>;

/**
 * Un texte facultatif : absent, vide ou nul deviennent tous `null`.
 *
 * ═══ CES SCHÉMAS DOIVENT ÊTRE IDEMPOTENTS ═══
 *
 * Ils sont appliqués DEUX FOIS sur le même trajet : une première fois sur la
 * saisie du formulaire, une seconde à l'entrée du dépôt, qui ne fait confiance
 * à personne. Si la sortie du premier passage n'était pas une entrée valable
 * pour le second, la seconde validation rejetterait ce que la première vient
 * d'accepter.
 *
 * C'est exactement ce qui se produisait : le premier passage transformait un
 * commentaire vide en `null`, et le second refusait `null` parce qu'il
 * n'acceptait qu'une chaîne ou une absence. Résultat, tout avis SANS
 * commentaire et toute prise SANS mesure étaient rejetés avec « saisie
 * invalide » — un défaut que seul un test contre une vraie base pouvait
 * révéler, et qui a survécu à toute la version PostgreSQL faute de pouvoir
 * l'exécuter.
 */
const optionalText = (max: number, message: string) =>
  z
    .union([z.string(), z.null()])
    .optional()
    .transform((value) => (value === undefined || value === null ? null : value.trim()))
    .refine((value) => value === null || value.length <= max, { message })
    .transform((value) => (value === null || value.length === 0 ? null : value));

/**
 * Une taille facultative se saisit comme un champ vide, pas comme un zéro.
 * `''` et `null` deviennent donc `null` AVANT la validation des bornes, sans
 * quoi le formulaire refuserait une prise dont on n'a pas mesuré la longueur.
 */
const optionalMeasure = (max: number, message: string) =>
  z
    .union([z.literal(''), z.null(), z.coerce.number()])
    .optional()
    .transform((value) =>
      value === '' || value === undefined || value === null ? null : Number(value),
    )
    .refine((value) => value === null || (Number.isFinite(value) && value >= 1 && value <= max), {
      message,
    })
    .transform((value) => (value === null ? null : Math.round(value)));

export const spotReviewInputSchema = z.object({
  spotSlug: z.string().min(1),
  rating: z.coerce
    .number({ required_error: 'Donnez une note.' })
    .int()
    .min(1, 'La note va de 1 à 5.')
    .max(5, 'La note va de 1 à 5.'),
  comment: optionalText(1200, 'Commentaire trop long (1 200 caractères au maximum).'),
});

export type SpotReviewInput = z.infer<typeof spotReviewInputSchema>;

export const catchSchema = z.object({
  id: z.string().uuid(),
  spotSlug: z.string(),
  userId: z.string().uuid(),
  authorName: z.string(),
  species: z.string(),
  lengthCm: z.number().int().nullable(),
  weightG: z.number().int().nullable(),
  released: z.boolean(),
  caughtAt: isoDateTime,
  note: z.string().nullable(),
  /** Chemin dans le seau de stockage, jamais une URL : elle se construit au rendu. */
  photoPath: z.string().nullable(),
  createdAt: isoDateTime,
});

export type Catch = z.infer<typeof catchSchema>;

export const catchInputSchema = z.object({
  spotSlug: z.string().min(1),
  species: z
    .string({ required_error: 'Quelle espèce ?' })
    .trim()
    .min(2, 'Nom d’espèce trop court.')
    .max(60, 'Nom d’espèce trop long.'),
  lengthCm: optionalMeasure(400, 'Longueur invalide (1 à 400 cm).'),
  weightG: optionalMeasure(200_000, 'Poids invalide (1 g à 200 kg).'),
  released: z.coerce.boolean().default(false),
  caughtAt: isoDateTime,
  note: optionalText(600, 'Note trop longue (600 caractères au maximum).'),
  photoPath: z.string().max(300).nullable().optional().default(null),
});

export type CatchInput = z.infer<typeof catchInputSchema>;
