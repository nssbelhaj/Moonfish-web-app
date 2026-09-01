import type { LightPhase } from '@/lib/scoring';
import type { SpotBottom } from './schemas';

/** Façade maritime, qui décide de la maille applicable. */
export type Sea = 'atlantique' | 'mediterranee';

export interface SpeciesInfo {
  slug: string;
  name: string;
  /** Nom scientifique, affiché en Spectral italique sous le nom courant. */
  latin: string;
  /**
   * Taille minimale de capture, en centimètres, par façade.
   *
   * `null` signifie « nous ne l'avons pas vérifiée », JAMAIS « pas de maille ».
   * L'interface l'écrit ainsi et renvoie à l'arrêté : afficher un montage à
   * côté d'une réglementation absente serait une invitation à l'infraction
   * (D5), et inventer un chiffre serait pire encore.
   */
  maille: Record<Sea, number | null>;
  /** Limite journalière quand elle existe. */
  dailyLimit?: string;
  /**
   * Fenêtre de marée favorable, en heures signées depuis la pleine mer.
   * Négatif = avant PM.
   */
  window: { fromH: number; toH: number };
  /** Phases lumineuses où l'espèce est active. */
  light: LightPhase[];
  /** Fonds sur lesquels elle se tient. */
  bottoms: SpotBottom[];
  /** Montage et appât, en une phrase. */
  rig: string;
}

/**
 * Référence réglementaire des mailles renseignées.
 * Elle est affichée telle quelle : une maille sans sa source ne vaut rien.
 */
export const MAILLE_REFERENCE = 'arrêté du 26 octobre 2012, à jour des révisions 2025';
export const MAILLE_SOURCE_URL = 'https://www.mer.gouv.fr/peche-de-loisir-en-mer';

/**
 * Catalogue des espèces du bord.
 *
 * Les fenêtres de marée et les montages sont des RÉGULARITÉS de pêche du bord,
 * pas des mesures : elles décrivent ce que la pratique enseigne, et l'interface
 * ne les présente jamais comme une prévision de prise.
 */
export const SPECIES: readonly SpeciesInfo[] = [
  {
    slug: 'bar',
    name: 'Bar',
    latin: 'Dicentrarchus labrax',
    maille: { atlantique: 42, mediterranee: 30 },
    dailyLimit: '2 par jour et par pêcheur en Atlantique nord-est, d’avril à octobre',
    window: { fromH: -2.5, toH: 1 },
    light: ['dawn', 'dusk', 'night'],
    bottoms: ['sable', 'sable-roche', 'roche', 'galets'],
    rig: 'Empile longue en 35/100, hameçon 2/0, ver ou lançon. Chercher le ressac et les veines de courant.',
  },
  {
    slug: 'loup',
    name: 'Loup',
    latin: 'Dicentrarchus labrax',
    maille: { atlantique: 42, mediterranee: 30 },
    window: { fromH: -2.5, toH: 1 },
    light: ['dawn', 'dusk', 'night'],
    bottoms: ['sable', 'sable-roche', 'roche', 'galets'],
    rig: 'Coulissant 28/100, hameçon 1/0, ver de sable ou bibi. Mer légèrement formée.',
  },
  {
    slug: 'sole',
    name: 'Sole',
    latin: 'Solea solea',
    maille: { atlantique: 25, mediterranee: 20 },
    window: { fromH: 1.5, toH: 4.5 },
    light: ['dusk', 'night'],
    bottoms: ['sable', 'vase-estuaire'],
    rig: 'Deux empiles courtes, hameçons 4, ver de vase. Traîner au ras du fond.',
  },
  {
    slug: 'lieu-jaune',
    name: 'Lieu jaune',
    latin: 'Pollachius pollachius',
    maille: { atlantique: 42, mediterranee: null },
    window: { fromH: -3, toH: -0.5 },
    light: ['dawn', 'dusk'],
    bottoms: ['roche', 'sable-roche'],
    rig: 'Leurre souple sur tête plombée légère, le long des roches et des laminaires.',
  },
  {
    slug: 'daurade-royale',
    name: 'Daurade royale',
    latin: 'Sparus aurata',
    maille: { atlantique: null, mediterranee: 23 },
    window: { fromH: -1, toH: 2 },
    light: ['day', 'dawn'],
    bottoms: ['sable', 'sable-roche'],
    rig: 'Bas de ligne 30/100, hameçon 1/0, crabe mou ou couteau. Attendre le calme de l’étale.',
  },
  {
    slug: 'dorade-royale',
    name: 'Dorade royale',
    latin: 'Sparus aurata',
    maille: { atlantique: null, mediterranee: 23 },
    window: { fromH: -1, toH: 2 },
    light: ['day', 'dawn'],
    bottoms: ['sable', 'sable-roche'],
    rig: 'Bas de ligne 30/100, hameçon 1/0, crabe mou ou couteau. Attendre le calme de l’étale.',
  },
  {
    slug: 'sar',
    name: 'Sar',
    latin: 'Diplodus sargus',
    maille: { atlantique: 23, mediterranee: 23 },
    window: { fromH: -2, toH: 1.5 },
    light: ['day', 'dawn', 'dusk'],
    bottoms: ['roche', 'sable-roche', 'galets'],
    rig: 'Ligne fine 22/100, hameçon 6, crabe ou moule. Le long des enrochements.',
  },
  {
    slug: 'marbre',
    name: 'Marbré',
    latin: 'Lithognathus mormyrus',
    maille: { atlantique: 20, mediterranee: 20 },
    window: { fromH: 1, toH: 4 },
    light: ['day', 'dawn'],
    bottoms: ['sable'],
    rig: 'Montage à gambes fines, hameçons 8, gravette. Dans la première barre.',
  },
  {
    slug: 'maigre',
    name: 'Maigre',
    latin: 'Argyrosomus regius',
    maille: { atlantique: null, mediterranee: null },
    window: { fromH: -1.5, toH: 0.5 },
    light: ['night', 'dusk'],
    bottoms: ['sable', 'vase-estuaire'],
    rig: 'Gros vif ou tête de calamar, hameçon 6/0, 40/100. Marquage de la caudale obligatoire.',
  },
  {
    slug: 'congre',
    name: 'Congre',
    latin: 'Conger conger',
    maille: { atlantique: null, mediterranee: null },
    window: { fromH: -0.7, toH: 0.7 },
    light: ['night'],
    bottoms: ['roche', 'sable-roche', 'galets'],
    rig: 'Bas de ligne acier, hameçon 8/0, tête de maquereau. Sur fonds durs uniquement.',
  },
  {
    slug: 'turbot',
    name: 'Turbot',
    latin: 'Scophthalmus maximus',
    maille: { atlantique: null, mediterranee: null },
    window: { fromH: 1.5, toH: 4.5 },
    light: ['day', 'dawn', 'dusk'],
    bottoms: ['sable'],
    rig: 'Empile longue, hameçon 2/0, lançon vif. Sur les bancs de sable balayés.',
  },
  {
    slug: 'plie',
    name: 'Plie',
    latin: 'Pleuronectes platessa',
    maille: { atlantique: null, mediterranee: null },
    window: { fromH: 1, toH: 4 },
    light: ['day', 'dawn'],
    bottoms: ['sable', 'vase-estuaire'],
    rig: 'Empiles courtes perlées, hameçons 4, arénicole.',
  },
  {
    slug: 'merlan',
    name: 'Merlan',
    latin: 'Merlangius merlangus',
    maille: { atlantique: null, mediterranee: null },
    window: { fromH: -2, toH: 2 },
    light: ['night', 'dusk'],
    bottoms: ['sable', 'vase-estuaire'],
    rig: 'Deux hameçons 1/0, lanière de maquereau. Pêche hivernale, souvent de nuit.',
  },
  {
    slug: 'maquereau',
    name: 'Maquereau',
    latin: 'Scomber scombrus',
    maille: { atlantique: 20, mediterranee: 18 },
    window: { fromH: -2.5, toH: 0.5 },
    light: ['dawn', 'dusk'],
    bottoms: ['roche', 'sable-roche', 'galets'],
    rig: 'Train de plumes, lancer léger. Quand le poisson chasse en surface.',
  },
  {
    slug: 'vieille',
    name: 'Vieille',
    latin: 'Labrus bergylta',
    maille: { atlantique: null, mediterranee: null },
    window: { fromH: -2, toH: 1 },
    light: ['day', 'dawn'],
    bottoms: ['roche', 'sable-roche'],
    rig: 'Ligne courte, hameçon 2, crabe vert. À l’aplomb des roches.',
  },
];

export const SPECIES_BY_NAME = new Map(SPECIES.map((s) => [s.name.toLowerCase(), s]));

/** Façade d'un spot, d'après sa région. */
export function seaOf(regionSlug: string): Sea {
  return regionSlug === 'occitanie' ? 'mediterranee' : 'atlantique';
}
