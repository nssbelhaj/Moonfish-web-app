import type { Sea, SpotBottom } from './schemas';

export type { Sea };

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
 * ═══════════════════════════════════════════════════════════════════════════
 *  Le cadre réglementaire dépend du PAYS, pas seulement de la façade
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Les mailles de ce catalogue viennent toutes de l'arrêté français du
 * 26 octobre 2012. Tant que le site ne couvrait que la France, les afficher
 * partout était sans conséquence. Ça a cessé de l'être : le site affichait
 * « Maille 42 cm · arrêté du 26 octobre 2012 » sur les spots marocains, où ce
 * texte n'a aucune valeur et où les tailles marchandes sont fixées par le
 * département de la Pêche maritime.
 *
 * Un chiffre faux assorti d'une source fausse est pire qu'une absence : il a
 * l'air vérifié. Un pêcheur qui garde une prise sur cette base est en
 * infraction dans son pays, en croyant suivre la règle.
 *
 * Nos données ne couvrent que la France. Pour les autres pays, `label` vaut
 * `null` : l'interface n'affiche AUCUN chiffre et renvoie à l'autorité
 * compétente, nommée pour que le lien ne soit pas aveugle.
 */
export interface MailleReference {
  /** Texte de référence. `null` = nos données ne couvrent pas ce pays. */
  label: string | null;
  /** Autorité à consulter, nommée dans la phrase. */
  authority: string;
  url: string;
}

export const MAILLE_REFERENCES: Readonly<Record<string, MailleReference>> = {
  france: {
    label: 'arrêté du 26 octobre 2012, à jour des révisions 2025',
    authority: 'ministère de la Mer',
    url: 'https://www.mer.gouv.fr/peche-de-loisir-en-mer',
  },
  espagne: {
    label: null,
    authority: 'ministère espagnol de l’Agriculture et de la Pêche (MAPA)',
    url: 'https://www.mapa.gob.es/es/pesca/temas/control-inspeccion-lucha-pesca-ilegal/informacion-sobre-actividad-pesquera/detalle/buscador_especies',
  },
  maroc: {
    label: null,
    authority: 'département de la Pêche maritime du Maroc',
    url: 'http://www.mpm.gov.ma/',
  },
};

/** Repli pour un pays non répertorié : aucun chiffre, et on le dit. */
const REFERENCE_INCONNUE: MailleReference = {
  label: null,
  authority: 'l’autorité de pêche compétente localement',
  url: 'https://www.mer.gouv.fr/peche-de-loisir-en-mer',
};

export function mailleReferenceOf(countrySlug: string): MailleReference {
  return MAILLE_REFERENCES[countrySlug] ?? REFERENCE_INCONNUE;
}

/**
 * Maille applicable, ou `null` si nos données ne la couvrent pas ICI.
 *
 * Deux raisons de rendre `null`, et l'interface les traite pareil parce
 * qu'elles disent la même chose : « nous ne l'avons pas vérifiée ».
 */
export function mailleFor(
  species: SpeciesInfo,
  countrySlug: string,
  sea: Sea,
): number | null {
  if (mailleReferenceOf(countrySlug).label === null) return null;
  return species.maille[sea];
}

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

