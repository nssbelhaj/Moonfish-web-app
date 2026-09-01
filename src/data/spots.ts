import { spotSchema, type Spot } from './schemas';

/**
 * Les 12 spots du MVP.
 *
 * Coordonnées réelles, orientations relevées sur carte. Les descriptions et les
 * espèces cibles décrivent la réalité du terrain : c'est le seul contenu de
 * cette version qui ne soit pas simulé, et il n'y a aucune raison de l'inventer.
 *
 * Demain, ce tableau disparaît au profit d'un `select * from spots` : c'est
 * précisément pourquoi il est validé par le même schéma que la future réponse.
 */
const RAW_SPOTS: Spot[] = [
  {
    slug: 'pen-hat',
    name: 'Pen Hat',
    countrySlug: 'france',
    countryName: 'France',
    regionSlug: 'bretagne',
    regionName: 'Bretagne',
    lat: 48.2856,
    lng: -4.6017,
    timezone: 'Europe/Paris',
    facingDeg: 290,
    exposure: 'tres-expose',
    bottom: 'sable-roche',
    type: 'plage',
    techniques: ['surfcasting', 'lancer-ramener', 'rockfishing'],
    species: ['Bar', 'Lieu jaune', 'Vieille', 'Maquereau'],
    meanTideRangeM: 5.6,
    summary:
      'Anse encaissée de la presqu’île de Crozon, ouverte plein ouest sur l’Iroise. La houle atlantique y entre sans obstacle et creuse des baïnes entre les têtes de roche : c’est ce qui fait la qualité du poste et son danger. Le bar y chasse dans le ressac dès que la mer se forme.',
    access:
      'Parking au bout de la route de Pen Hat, puis sentier descendant sur 300 m. Descente glissante par temps humide, dernière portion sur galets. Estran impraticable en houle de plus de 2 m.',
  },
  {
    slug: 'le-dossen',
    name: 'Le Dossen',
    countrySlug: 'france',
    countryName: 'France',
    regionSlug: 'bretagne',
    regionName: 'Bretagne',
    lat: 48.7092,
    lng: -4.0367,
    timezone: 'Europe/Paris',
    facingDeg: 340,
    exposure: 'expose',
    bottom: 'sable',
    type: 'plage',
    techniques: ['surfcasting', 'lancer-ramener', 'peche-a-pied'],
    species: ['Bar', 'Sole', 'Turbot', 'Raie bouclée'],
    meanTideRangeM: 6.8,
    summary:
      'Longue plage de sable de Santec, exposée nord-nord-ouest, avec un marnage parmi les plus forts de France. Le sable dégagé à basse mer laisse voir les courants et les fosses : les repérer une fois vaut dix sorties à l’aveugle. Bonne tenue de la sole en été.',
    access:
      'Grand parking à l’entrée de la plage, accès de plain-pied. Attention à la montante qui isole rapidement les bancs de sable au nord de l’estran.',
  },
  {
    slug: 'la-torche',
    name: 'La Torche',
    countrySlug: 'france',
    countryName: 'France',
    regionSlug: 'bretagne',
    regionName: 'Bretagne',
    lat: 47.8375,
    lng: -4.3708,
    timezone: 'Europe/Paris',
    facingDeg: 250,
    exposure: 'tres-expose',
    bottom: 'sable',
    type: 'pointe',
    techniques: ['surfcasting', 'lancer-ramener'],
    species: ['Bar', 'Maigre', 'Sole', 'Bar moucheté'],
    meanTideRangeM: 4.9,
    summary:
      'Pointe de la baie d’Audierne, réputée pour sa houle et fréquentée par les surfeurs. Côté pêche, l’intérêt est dans les courants de retour qui longent la pointe et concentrent la nourriture. Poste à privilégier tôt le matin, avant la fréquentation.',
    access:
      'Parking de la pointe, accès direct. Les rouleaux du côté nord rendent le bord de l’eau dangereux dès 1,5 m de houle : rester sur la partie basse de la plage sud.',
  },
  {
    slug: 'etretat',
    name: 'Étretat',
    countrySlug: 'france',
    countryName: 'France',
    regionSlug: 'normandie',
    regionName: 'Normandie',
    lat: 49.7075,
    lng: 0.2008,
    timezone: 'Europe/Paris',
    facingDeg: 315,
    exposure: 'expose',
    bottom: 'galets',
    type: 'plage',
    techniques: ['surfcasting', 'rockfishing', 'peche-a-soutenir', 'peche-a-pied'],
    species: ['Bar', 'Maquereau', 'Congre', 'Dorade grise'],
    meanTideRangeM: 7.2,
    summary:
      'Plage de galets encadrée par les falaises, avec des platiers rocheux découvrant à basse mer de part et d’autre. Le galet impose des plombs lourds et des bas de ligne courts. Le bar suit la laisse de mer sur la montante, très près du bord.',
    access:
      'Front de mer accessible à pied depuis le centre. Les platiers sud sont praticables à basse mer mais se couvrent vite : ne jamais s’y engager sans avoir noté l’heure de la renverse.',
  },
  {
    slug: 'gatteville-le-phare',
    name: 'Gatteville-le-Phare',
    countrySlug: 'france',
    countryName: 'France',
    regionSlug: 'normandie',
    regionName: 'Normandie',
    lat: 49.6944,
    lng: -1.2764,
    timezone: 'Europe/Paris',
    facingDeg: 50,
    exposure: 'expose',
    bottom: 'roche',
    type: 'estran-rocheux',
    techniques: ['rockfishing', 'shore-jigging', 'lancer-ramener', 'peche-a-soutenir'],
    species: ['Bar', 'Lieu jaune', 'Congre', 'Vieille'],
    meanTideRangeM: 5.4,
    summary:
      'Pointe de Barfleur, un des courants de marée les plus violents des côtes françaises. L’orientation nord-est protège de la houle d’ouest dominante mais expose au vent de terre. Le raz de Barfleur brasse en permanence : le poisson y est présent, l’accès y est technique.',
    access:
      'Parking du phare, puis estran rocheux irrégulier. Chaussures à crampons indispensables. Le courant de la pointe est un vrai danger : ne jamais descendre sous la laisse de haute mer par gros coefficient.',
  },
  {
    slug: 'le-touquet',
    name: 'Le Touquet',
    countrySlug: 'france',
    countryName: 'France',
    regionSlug: 'hauts-de-france',
    regionName: 'Hauts-de-France',
    lat: 50.5222,
    lng: 1.5836,
    timezone: 'Europe/Paris',
    facingDeg: 280,
    exposure: 'semi-abrite',
    bottom: 'sable',
    type: 'plage',
    techniques: ['surfcasting', 'peche-a-pied', 'lancer-ramener'],
    species: ['Bar', 'Sole', 'Plie', 'Merlan'],
    meanTideRangeM: 8.1,
    summary:
      'Immense estran de sable qui découvre sur près d’un kilomètre à basse mer, à l’embouchure de la Canche. Le marnage y est le plus fort du littoral français continental. Poste de référence pour la sole en été et le merlan en hiver.',
    access:
      'Plusieurs accès depuis le front de mer, tous de plain-pied. La montante remonte très vite sur un estran aussi plat : prévoir une marge d’une heure sur l’heure de basse mer.',
  },
  {
    slug: 'wissant',
    name: 'Wissant',
    countrySlug: 'france',
    countryName: 'France',
    regionSlug: 'hauts-de-france',
    regionName: 'Hauts-de-France',
    lat: 50.8858,
    lng: 1.6636,
    timezone: 'Europe/Paris',
    facingDeg: 325,
    exposure: 'expose',
    bottom: 'sable',
    type: 'plage',
    techniques: ['surfcasting', 'lancer-ramener', 'peche-a-pied'],
    species: ['Bar', 'Sole', 'Turbot', 'Raie bouclée'],
    meanTideRangeM: 7.4,
    summary:
      'Baie entre le cap Gris-Nez et le cap Blanc-Nez, ouverte au nord-ouest sur le Pas-de-Calais. Le fond de sable est parcouru de bancs mobiles et de fosses qui se déplacent d’une saison à l’autre. Le turbot s’y prend sur vif à proximité des cassures.',
    access:
      'Parking du centre de Wissant, accès direct à la plage. Vent quasi permanent : le choix de la position dans la baie dépend surtout de son secteur.',
  },
  {
    slug: 'lacanau',
    name: 'Lacanau',
    countrySlug: 'france',
    countryName: 'France',
    regionSlug: 'nouvelle-aquitaine',
    regionName: 'Nouvelle-Aquitaine',
    lat: 45.0,
    lng: -1.2019,
    timezone: 'Europe/Paris',
    facingDeg: 270,
    exposure: 'tres-expose',
    bottom: 'sable',
    type: 'plage',
    techniques: ['surfcasting', 'lancer-ramener'],
    species: ['Bar', 'Maigre', 'Sole', 'Marbré'],
    meanTideRangeM: 3.9,
    summary:
      'Côte landaise rectiligne, entièrement sableuse, structurée par un système de baïnes qui se reforment à chaque coup de mer. La baïne est à la fois le poste de pêche et le piège : c’est elle qui concentre le poisson et qui emporte les baigneurs. Le maigre remonte en été.',
    access:
      'Accès aménagés depuis Lacanau-Océan. Lire la baïne à basse mer avant de pêcher : le courant de vidange est violent même par mer peu formée.',
  },
  {
    slug: 'cap-ferret',
    name: 'Cap Ferret',
    countrySlug: 'france',
    countryName: 'France',
    regionSlug: 'nouvelle-aquitaine',
    regionName: 'Nouvelle-Aquitaine',
    lat: 44.6333,
    lng: -1.25,
    timezone: 'Europe/Paris',
    facingDeg: 270,
    exposure: 'tres-expose',
    bottom: 'sable',
    type: 'pointe',
    techniques: ['surfcasting', 'lancer-ramener', 'peche-a-soutenir'],
    species: ['Bar', 'Maigre', 'Sole', 'Dorade royale'],
    meanTideRangeM: 4.1,
    summary:
      'Pointe qui sépare l’océan du bassin d’Arcachon. Deux régimes cohabitent : la côte océane, ouverte et puissante, et les passes, où le courant de vidange du bassin crée des veines de courant exceptionnelles à marée descendante. La dorade royale y est régulière en été.',
    access:
      'Accès océan par les plages aménagées ; les passes se pêchent depuis la pointe, sur un sable instable. Les bancs de la passe sont mortels à pied : rester au-dessus de la laisse de mer.',
  },
  {
    slug: 'l-espiguette',
    name: 'L’Espiguette',
    countrySlug: 'france',
    countryName: 'France',
    regionSlug: 'occitanie',
    regionName: 'Occitanie',
    lat: 43.515,
    lng: 4.14,
    timezone: 'Europe/Paris',
    facingDeg: 150,
    exposure: 'semi-abrite',
    bottom: 'sable',
    type: 'plage',
    techniques: ['surfcasting', 'lancer-ramener', 'peche-au-flotteur'],
    species: ['Loup', 'Daurade royale', 'Sar', 'Marbré'],
    meanTideRangeM: 0.35,
    summary:
      'Longue plage sauvage du Grau-du-Roi, au bout de la Camargue. Méditerranée : le marnage y est quasi nul, le facteur marée cède la place au vent et à la houle. Les coups de mistral et de tramontane structurent l’activité bien davantage que le cycle lunaire.',
    access:
      'Parking de l’Espiguette puis marche sur le sable, jusqu’à plusieurs kilomètres selon le poste visé. Aucun point d’eau ni ombre : prévoir en conséquence.',
  },
  {
    slug: 'plage-d-agadir',
    name: 'Plage d’Agadir',
    countrySlug: 'maroc',
    countryName: 'Maroc',
    regionSlug: 'souss-massa',
    regionName: 'Souss-Massa',
    lat: 30.4167,
    lng: -9.6,
    timezone: 'Africa/Casablanca',
    facingDeg: 265,
    exposure: 'expose',
    bottom: 'sable',
    type: 'plage',
    techniques: ['surfcasting', 'lancer-ramener', 'peche-au-flotteur'],
    species: ['Loup', 'Ombrine', 'Sar', 'Pageot'],
    meanTideRangeM: 2.4,
    summary:
      'Grande baie en arc, protégée au nord par le cap Ghir mais ouverte à la houle atlantique. Le fond de sable régulier convient au lancer lourd. L’ombrine, recherchée localement, se tient dans les fosses de bord dès que l’eau se trouble.',
    access:
      'Front de mer urbain, accès faciles sur toute la longueur. Les postes intéressants sont aux extrémités de la baie, loin de la fréquentation balnéaire.',
  },
  {
    slug: 'taghazout',
    name: 'Taghazout',
    countrySlug: 'maroc',
    countryName: 'Maroc',
    regionSlug: 'souss-massa',
    regionName: 'Souss-Massa',
    lat: 30.545,
    lng: -9.71,
    timezone: 'Africa/Casablanca',
    facingDeg: 275,
    exposure: 'expose',
    bottom: 'sable-roche',
    type: 'estran-rocheux',
    techniques: ['rockfishing', 'shore-jigging', 'lancer-ramener', 'surfcasting'],
    species: ['Loup', 'Sar', 'Mérou brun', 'Bonite'],
    meanTideRangeM: 2.2,
    summary:
      'Village de pêcheurs au nord d’Agadir, alternance de pointes rocheuses et de criques de sable. Les platiers permettent de pêcher au-dessus de fonds mixtes sans embarcation, ce qui est rare. Houle longue et régulière une bonne partie de l’année.',
    access:
      'Accès par les sentiers depuis la route côtière. Roche très coupante et couverte d’algues : semelles adaptées obligatoires. Les platiers se couvrent rapidement sur la montante.',
  },
];

/** Les spots sont validés au chargement du module : un mock mal formé casse le build, pas la page. */
export const SPOTS: readonly Spot[] = Object.freeze(
  RAW_SPOTS.map((spot) => spotSchema.parse(spot)),
);

export const EXPOSURE_LABELS: Record<Spot['exposure'], string> = {
  abrite: 'Abrité',
  'semi-abrite': 'Semi-abrité',
  expose: 'Exposé',
  'tres-expose': 'Très exposé',
};

export const BOTTOM_LABELS: Record<Spot['bottom'], string> = {
  sable: 'Sable',
  'sable-roche': 'Sable et roche',
  roche: 'Roche',
  galets: 'Galets',
  'vase-estuaire': 'Vase d’estuaire',
};

export const TECHNIQUE_LABELS: Record<Spot['techniques'][number], string> = {
  surfcasting: 'Surfcasting',
  'lancer-ramener': 'Lancer-ramener',
  rockfishing: 'Rockfishing',
  'shore-jigging': 'Shore-jigging',
  'peche-a-soutenir': 'Pêche à soutenir',
  'peche-au-flotteur': 'Pêche au flotteur',
  'peche-a-pied': 'Pêche à pied',
};

/** Une phrase par technique, pour que le tag ne soit pas qu'un mot-clé. */
export const TECHNIQUE_DESCRIPTIONS: Record<Spot['techniques'][number], string> = {
  surfcasting:
    'Lancer lourd depuis la plage, appâts naturels posés au fond. La technique de référence sur les grands estrans de sable.',
  'lancer-ramener':
    'Leurres ramenés depuis le bord, en prospection. Efficace sur les prédateurs qui chassent dans le ressac.',
  rockfishing:
    'Pêche légère aux leurres souples le long des roches et des platiers, sur les postes accidentés.',
  'shore-jigging':
    'Jigs lancés loin et animés verticalement depuis la roche, là où le fond décroche vite près du bord.',
  'peche-a-soutenir':
    'Ligne tenue à la main ou à la canne courte, à l’aplomb d’une digue ou d’une cassure.',
  'peche-au-flotteur':
    'Esche présentée entre deux eaux sous un flotteur, adaptée aux eaux calmes et aux fonds propres.',
  'peche-a-pied':
    'Récolte à marée basse sur l’estran découvert. Réglementée : tailles, quotas et zones varient selon les départements.',
};

export const SPOT_TYPE_LABELS: Record<Spot['type'], string> = {
  plage: 'Plage',
  'estran-rocheux': 'Estran rocheux',
  pointe: 'Pointe',
  estuaire: 'Estuaire',
  digue: 'Digue',
};
