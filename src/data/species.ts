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
   * Fonds sur lesquels l'espèce se tient. C'est de l'histoire naturelle, pas
   * une statistique de prise : un congre demande du dur, partout et toujours.
   */
  bottoms: SpotBottom[];
  /** Ce que la pratique enseigne du moment de la journée, sans horaire chiffré. */
  moment: string;
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
    bottoms: ['sable', 'sable-roche', 'roche', 'galets'],
    moment:
      'Chasse surtout dans la lumière basse et le ressac. Les pêcheurs la cherchent autour de la pleine mer, sans que cela vaille règle.',
    rig: 'Empile longue en 35/100, hameçon 2/0, ver ou lançon. Chercher le ressac et les veines de courant.',
  },
  {
    slug: 'loup',
    name: 'Loup',
    latin: 'Dicentrarchus labrax',
    maille: { atlantique: 42, mediterranee: 30 },
    bottoms: ['sable', 'sable-roche', 'roche', 'galets'],
    moment:
      'Se prend de nuit comme de jour ; la mer légèrement formée le met en confiance.',
    rig: 'Coulissant 28/100, hameçon 1/0, ver de sable ou bibi. Mer légèrement formée.',
  },
  {
    slug: 'sole',
    name: 'Sole',
    latin: 'Solea solea',
    maille: { atlantique: 25, mediterranee: 20 },
    bottoms: ['sable', 'vase-estuaire'],
    moment:
      'Poisson de nuit, sur le sable. Se pêche au ras du fond, à la traîne lente.',
    rig: 'Deux empiles courtes, hameçons 4, ver de vase. Traîner au ras du fond.',
  },
  {
    slug: 'lieu-jaune',
    name: 'Lieu jaune',
    latin: 'Pollachius pollachius',
    maille: { atlantique: 42, mediterranee: null },
    bottoms: ['roche', 'sable-roche'],
    moment:
      'Le long des roches et des laminaires, dans les premières et les dernières heures du jour.',
    rig: 'Leurre souple sur tête plombée légère, le long des roches et des laminaires.',
  },
  {
    slug: 'daurade-royale',
    name: 'Daurade royale',
    latin: 'Sparus aurata',
    maille: { atlantique: null, mediterranee: 23 },
    bottoms: ['sable', 'sable-roche'],
    moment:
      'Recherchée de jour sur les fonds mêlés, quand le courant faiblit.',
    rig: 'Bas de ligne 30/100, hameçon 1/0, crabe mou ou couteau. Attendre le calme de l’étale.',
  },
  {
    slug: 'dorade-royale',
    name: 'Dorade royale',
    latin: 'Sparus aurata',
    maille: { atlantique: null, mediterranee: 23 },
    bottoms: ['sable', 'sable-roche'],
    moment:
      'Recherchée de jour sur les fonds mêlés, quand le courant faiblit.',
    rig: 'Bas de ligne 30/100, hameçon 1/0, crabe mou ou couteau. Attendre le calme de l’étale.',
  },
  {
    slug: 'sar',
    name: 'Sar',
    latin: 'Diplodus sargus',
    maille: { atlantique: 23, mediterranee: 23 },
    bottoms: ['roche', 'sable-roche', 'galets'],
    moment:
      'Actif de jour le long des enrochements, souvent à quelques mètres du bord.',
    rig: 'Ligne fine 22/100, hameçon 6, crabe ou moule. Le long des enrochements.',
  },
  {
    slug: 'marbre',
    name: 'Marbré',
    latin: 'Lithognathus mormyrus',
    maille: { atlantique: 20, mediterranee: 20 },
    bottoms: ['sable'],
    moment:
      'De jour, dans la première barre, sur le sable propre.',
    rig: 'Montage à gambes fines, hameçons 8, gravette. Dans la première barre.',
  },
  {
    slug: 'maigre',
    name: 'Maigre',
    latin: 'Argyrosomus regius',
    maille: { atlantique: null, mediterranee: null },
    bottoms: ['sable', 'vase-estuaire'],
    moment:
      'Poisson de nuit, près des embouchures et des fosses. Rare et recherché.',
    rig: 'Gros vif ou tête de calamar, hameçon 6/0, 40/100. Marquage de la caudale obligatoire.',
  },
  {
    slug: 'congre',
    name: 'Congre',
    latin: 'Conger conger',
    maille: { atlantique: null, mediterranee: null },
    bottoms: ['roche', 'sable-roche', 'galets'],
    moment:
      'Strictement nocturne, sur les fonds durs. Rien à en attendre sur du sable nu.',
    rig: 'Bas de ligne acier, hameçon 8/0, tête de maquereau. Sur fonds durs uniquement.',
  },
  {
    slug: 'turbot',
    name: 'Turbot',
    latin: 'Scophthalmus maximus',
    maille: { atlantique: null, mediterranee: null },
    bottoms: ['sable'],
    moment:
      'Embusqué sur les bancs de sable balayés par le courant.',
    rig: 'Empile longue, hameçon 2/0, lançon vif. Sur les bancs de sable balayés.',
  },
  {
    slug: 'plie',
    name: 'Plie',
    latin: 'Pleuronectes platessa',
    maille: { atlantique: null, mediterranee: null },
    bottoms: ['sable', 'vase-estuaire'],
    moment:
      'De jour, sur le sable et la vase, en pêche fine.',
    rig: 'Empiles courtes perlées, hameçons 4, arénicole.',
  },
  {
    slug: 'merlan',
    name: 'Merlan',
    latin: 'Merlangius merlangus',
    maille: { atlantique: null, mediterranee: null },
    bottoms: ['sable', 'vase-estuaire'],
    moment:
      'Pêche hivernale, souvent de nuit, sur les fonds meubles.',
    rig: 'Deux hameçons 1/0, lanière de maquereau. Pêche hivernale, souvent de nuit.',
  },
  {
    slug: 'maquereau',
    name: 'Maquereau',
    latin: 'Scomber scombrus',
    maille: { atlantique: 20, mediterranee: 18 },
    bottoms: ['roche', 'sable-roche', 'galets'],
    moment:
      'Quand le poisson chasse en surface, surtout au lever et au coucher du jour.',
    rig: 'Train de plumes, lancer léger. Quand le poisson chasse en surface.',
  },
  {
    slug: 'vieille',
    name: 'Vieille',
    latin: 'Labrus bergylta',
    maille: { atlantique: null, mediterranee: null },
    bottoms: ['roche', 'sable-roche'],
    moment:
      'De jour, à l’aplomb des roches. Ne s’éloigne pas de son abri.',
    rig: 'Ligne courte, hameçon 2, crabe vert. À l’aplomb des roches.',
  },
];

export const SPECIES_BY_NAME = new Map(SPECIES.map((s) => [s.name.toLowerCase(), s]));

/** Façade d'un spot, d'après sa région. */
export function seaOf(regionSlug: string): Sea {
  return regionSlug === 'occitanie' ? 'mediterranee' : 'atlantique';
}
