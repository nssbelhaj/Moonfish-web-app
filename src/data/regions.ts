import { PAYS, type PaysCatalogue } from './spots';
import type { Spot } from './schemas';

/**
 * Ce qu'une région a de particulier pour la pêche du bord.
 *
 * Même règle que les fiches pays : ici ne vit que ce qu'aucun calcul ne
 * donne — le caractère de la côte, ce qu'on y pêche et comment, le piège
 * propre au lieu. Le nombre de spots, les espèces citées, les scores en
 * direct viennent du catalogue et des prévisions.
 *
 * Trois paragraphes courts, pas un guide : la page région est une porte
 * d'entrée (« pêche du bord en Bretagne »), pas une lecture suivie.
 */
export interface FicheRegion {
  slug: string;
  /** « Pêcher du bord en Bretagne » — avec la préposition qui convient. */
  titre: string;
  /** Deux phrases sur le caractère de la côte. */
  accroche: string;
  /** Le terrain : fonds, exposition, marée — ce qui dicte la technique. */
  terrain: string;
  /** Le piège du lieu, ou le conseil qui évite la sortie pour rien. */
  conseil: string;
}

export const FICHES_REGIONS: Readonly<Record<string, FicheRegion>> = {
  bretagne: {
    slug: 'bretagne',
    titre: 'Pêcher du bord en Bretagne',
    accroche:
      'La côte la plus découpée de France, et la plus variée : anses de sable entre des pointes de roche, estrans qui découvrent sur des centaines de mètres, houle atlantique plein ouest sur la presqu’île de Crozon et la baie d’Audierne. Le bar y est chez lui toute la belle saison.',
    terrain:
      'Marnage de 5 à 6 m en vive-eau : un poste change de nature entre basse et pleine mer. Sable et roche mêlés presque partout, ce qui fait le surfcasting sur les plages exposées, le lancer-ramener depuis les pointes, et le rockfishing sur les platiers. Vieille, lieu et maquereau tiennent la roche ; bar et sole travaillent le sable.',
    conseil:
      'La houle d’ouest ferme les anses ouvertes plusieurs jours de suite et rend les platiers dangereux bien avant que la mer ait l’air grosse. Regardez la période de la houle autant que sa hauteur : 2 m à 14 secondes balaient une pointe que 2 m à 7 secondes laissent pêchable.',
  },
  normandie: {
    slug: 'normandie',
    titre: 'Pêcher du bord en Normandie',
    accroche:
      'Les falaises de craie du pays de Caux et les platiers du Cotentin. Une côte de Manche, avec des marées parmi les plus fortes du monde et une eau souvent chargée, que le bar et le lieu jaune aiment.',
    terrain:
      'Galets et platiers rocheux au pied des falaises, sable dans les baies. Le marnage dépasse 8 m vers Barfleur : la fenêtre autour de la pleine mer est courte et intense, le courant y est fort, et les plombs grappins sont la règle en surfcasting. Le lancer-ramener depuis les épis et les jetées donne bien sur le bar.',
    conseil:
      'Au pied d’une falaise, la marée monte plus vite qu’on ne marche sur le galet, et la falaise elle-même s’effondre par blocs. Repérez toujours l’escalier ou la valleuse par laquelle vous remonterez, et ne pêchez jamais à la montante sans savoir où elle vous coupera.',
  },
  'hauts-de-france': {
    slug: 'hauts-de-france',
    titre: 'Pêcher du bord dans les Hauts-de-France',
    accroche:
      'Les grandes plages de sable de la Côte d’Opale et la baie de Somme : des kilomètres d’estran, un vent presque constant, et une pêche du bord d’hiver que peu de régions offrent — merlan, plie et flet quand le bar est parti.',
    terrain:
      'Sable presque partout, avec les caps rocheux de Gris-Nez et Blanc-Nez pour changer. Marnage de 7 à 9 m : à basse mer, l’eau est à des centaines de mètres, et le poste ne vaut qu’autour de la pleine mer. Le surfcasting à deux ou trois empiles, sur ver de sable et lançon, est la technique du lieu ; la baie de Somme se pêche aussi à pied, aux coques et aux couteaux.',
    conseil:
      'En baie de Somme, la mer revient par les chenaux avant de recouvrir les bancs : on se retrouve sur une île qui rétrécit. Sortez avec l’heure de basse mer en tête, et repartez quand elle tourne — pas quand l’eau arrive.',
  },
  'nouvelle-aquitaine': {
    slug: 'nouvelle-aquitaine',
    titre: 'Pêcher du bord en Nouvelle-Aquitaine',
    accroche:
      'Deux cent cinquante kilomètres de plage rectiligne, de la Gironde au Pays basque, face à l’Atlantique sans un obstacle. C’est le pays des baïnes, du surfcasting de nuit et du bar qui chasse dans le ressac — et, au sud, des premiers rochers depuis Bordeaux.',
    terrain:
      'Sable fin sur toute la côte landaise et girondine, roche seulement à partir de Biarritz. Marnage de 3 à 4 m. Les baïnes — ces bassins que la marée remplit puis vide par une passe — sont les postes : à mi-descendante, la passe concentre le courant et le poisson. Le surfcasting y est roi ; le lancer-ramener prend le relais dans les passes et sur la côte basque.',
    conseil:
      'La baïne qui fait le poste est aussi ce qui noie les baigneurs : le courant de sortie emporte un adulte debout. Ne pêchez jamais dans l’eau au-dessus du genou à la descendante, et méfiez-vous des vagues de bord sur une plage qui a l’air calme.',
  },
  occitanie: {
    slug: 'occitanie',
    titre: 'Pêcher du bord en Occitanie',
    accroche:
      'Le golfe du Lion : des lidos de sable entre mer et étangs, presque pas de marée, et le vent qui commande tout. Loup, daurade et marbré viennent au bord sur les plages ouvertes, et les graus entre étang et mer sont des postes à part.',
    terrain:
      'Sable fin sur des dizaines de kilomètres, pente douce, fonds propres. Marnage de quelques dizaines de centimètres : oubliez le coefficient, regardez le vent. Le surfcasting léger et la pêche à soutenir sur ver de sable, bibi ou couteau font l’essentiel ; le lancer-ramener au leurre sur les graus et les digues au lever du jour.',
    conseil:
      'Tramontane et mistral se lèvent en une heure et soufflent trois jours : ils plaquent l’eau au large, la refroidissent et vident le bord. Le vent marin (sud-est), lui, ramène l’eau et le poisson — c’est la fenêtre à guetter, avant qu’il ne forme trop la mer.',
  },
  'souss-massa': {
    slug: 'souss-massa',
    titre: 'Pêcher du bord dans le Souss-Massa',
    accroche:
      'Agadir et sa baie abritée au sud, la côte rocheuse de Taghazout au nord : deux mondes à trente kilomètres. L’Atlantique y arrive de plein fouet sur des dalles et des pointes, avec une eau qui reste entre 16 et 22 °C toute l’année grâce aux remontées d’eau froide du large.',
    terrain:
      'Plage de sable en pente douce dans la baie d’Agadir, plates-formes rocheuses et blocs vers Taghazout et Tamri. Marnage de 2,5 à 3 m. Le surfcasting sur la plage, le rockfishing et la pêche à soutenir sur les dalles, où le sar et le loup tiennent le bord même en hiver. La courbine — le maigre — remonte du printemps à l’automne.',
    conseil:
      'Les dalles de Taghazout sont des spots de surf pour une raison : la houle du large y déferle sans prévenir. Une plate-forme sèche depuis une heure peut être balayée par une série. Pêchez toujours face à la mer, et ne descendez pas sur une dalle que vous ne pourriez pas quitter en courant.',
  },
  'casablanca-settat': {
    slug: 'casablanca-settat',
    titre: 'Pêcher du bord dans la région de Casablanca',
    accroche:
      'La corniche d’Aïn Diab au cœur de la ville, et la lagune d’Oualidia deux heures au sud : la pêche du bord marocaine dans ce qu’elle a de plus accessible et de plus contrasté. La roche urbaine d’un côté, une lagune abritée qui se vide et se remplit de l’autre.',
    terrain:
      'Plates-formes rocheuses et petites plages à Casablanca, où l’on pêche à soutenir et au lancer entre les blocs ; sable et chenaux à Oualidia, où la marée fait tout le jeu — la passe de la lagune concentre le courant et le poisson à chaque cycle. Marnage d’environ 3 m. Sar, loup, ombrine et daurade dominent.',
    conseil:
      'À Oualidia, la lagune se vide vite à la descendante et les bancs découverts sont vaseux par endroits ; à Casablanca, la houle d’hiver rend la corniche impraticable et les rochers glissants sous une eau qui paraît calme. Dans les deux cas, choisissez un coefficient moyen pour vos premières sorties.',
  },
  'tanger-tetouan-al-hoceima': {
    slug: 'tanger-tetouan-al-hoceima',
    titre: 'Pêcher du bord entre Tanger et Al Hoceïma',
    accroche:
      'La seule région du catalogue qui touche deux mers : les plages atlantiques d’Asilah et d’Achakar face au détroit, et les criques méditerranéennes d’Al Hoceïma. À Tanger, le courant du détroit de Gibraltar fait des postes que rien d’autre ne remplace.',
    terrain:
      'Sable et roche sur l’Atlantique, avec un marnage de 2 à 3 m et des courants de détroit ; criques rocheuses et eau claire en Méditerranée, presque sans marée, où le rockfishing et la pêche au flotteur prennent le dessus. Sar, loup, daurade et, en saison, bonite et pélamide qui passent au large des caps.',
    conseil:
      'Le détroit est un couloir de vent : levante et poniente s’y engouffrent et changent la mer en quelques heures. Une plage pêchable le matin ne l’est plus à midi. Consultez le vent prévu pour l’heure de la sortie, pas celui du moment où vous partez.',
  },
  'rabat-sale-kenitra': {
    slug: 'rabat-sale-kenitra',
    titre: 'Pêcher du bord près de Rabat',
    accroche:
      'Mehdia et l’embouchure du Sebou : une grande plage atlantique et la jetée d’un fleuve qui apporte au bord tout ce qu’un estuaire nourrit. C’est l’un des postes les plus fréquentés du pays, et l’un des plus réguliers.',
    terrain:
      'Sable en pente douce sur la plage, enrochements et jetée à l’embouchure. Marnage d’environ 3 m. Le surfcasting sur la plage à la montante, la pêche à soutenir depuis la jetée où le courant du fleuve rencontre la marée. Loup, ombrine, sar, sole ; le maigre remonte l’estuaire en saison.',
    conseil:
      'À l’embouchure, le courant du Sebou et la marée se contrarient : à la descendante par fort débit, le courant emporte les lignes et tout ce qui flotte. Pêchez la jetée à la montante, et la plage à la pleine mer.',
  },
  'marrakech-safi': {
    slug: 'marrakech-safi',
    titre: 'Pêcher du bord entre Safi et Essaouira',
    accroche:
      'La côte la plus sauvage du Maroc atlantique : falaises, dalles et baies ouvertes plein ouest, avec le vent d’Essaouira comme compagnon permanent. C’est un pays de rockfishing et de pêche à soutenir sur la roche, plus que de surfcasting.',
    terrain:
      'Plates-formes rocheuses et petites plages de sable entre des pointes. Marnage de 2,5 à 3 m. L’eau y est parmi les plus froides du pays — les remontées d’eau du large — et parmi les plus poissonneuses : sar, loup, ombrine, daurade sur la roche, sole et courbine sur le sable des baies.',
    conseil:
      'Le vent d’Essaouira souffle du nord presque tous les après-midi de la belle saison et rend la mer courte et blanche : pêchez tôt, avant qu’il ne se lève. Sur les dalles de Safi, la houle d’hiver ne prévient pas plus qu’à Taghazout.',
  },
  'dakhla-oued-eddahab': {
    slug: 'dakhla-oued-eddahab',
    titre: 'Pêcher du bord à Dakhla',
    accroche:
      'La lagune de Dakhla et l’océan de l’autre côté de la presqu’île : quarante kilomètres d’eau abritée d’un côté, l’Atlantique du Sahara de l’autre, avec le courant froid des Canaries et une richesse en poisson que peu de côtes égalent.',
    terrain:
      'Sable et vase dans la lagune, roche et plages ouvertes côté océan. Marnage d’environ 2 m. La lagune se pêche à soutenir et au lancer sur une eau calme — courbine, sar, daurade — quand l’océan demande du surfcasting lourd face à une houle de plein ouest.',
    conseil:
      'Le vent de nord-est souffle presque toute l’année et fait de Dakhla un spot de kitesurf : il rend le lancer difficile côté lagune et lève un clapot court. Le matin est la fenêtre. Loin de tout, prévoyez eau, essence et une personne prévenue de votre poste.',
  },
  oriental: {
    slug: 'oriental',
    titre: 'Pêcher du bord à Saïdia',
    accroche:
      'La plage de Saïdia, quatorze kilomètres de sable méditerranéen jusqu’à la frontière algérienne, et l’embouchure de la Moulouya. Une côte sans marée, où le vent et l’apport du fleuve décident de tout.',
    terrain:
      'Sable fin en pente douce, marnage de quelques dizaines de centimètres. Surfcasting léger et pêche à soutenir sur vers et crabe ; le lancer-ramener à l’embouchure de la Moulouya et le long de la digue du port, où loup et daurade chassent au lever du jour.',
    conseil:
      'Le chergui, vent d’est chaud, forme la mer et la trouble ; il ferme la plage mais ouvre l’embouchure, où le poisson vient se réfugier dans l’eau moins agitée. Le lendemain d’un coup d’est est souvent la meilleure journée.',
  },
  galicia: {
    slug: 'galicia',
    titre: 'Pêcher du bord en Galice',
    accroche:
      'La Costa da Morte et les rias : la côte atlantique la plus sauvage d’Espagne, où la houle arrive sans obstacle sur des plages de sable blanc et des pointes de granit. Les rias, elles, sont des bras de mer abrités qui se vident et se remplissent avec la marée.',
    terrain:
      'Sable et granit alternés, marnage de 3 à 4 m. Le surfcasting sur les plages ouvertes, lancer-ramener sur les pointes, pêche à soutenir dans les rias où l’eau est calme même par gros temps dehors. Lubina (bar), sar, daurade, et la sole sur le sable des rias.',
    conseil:
      'La Costa da Morte porte son nom : les vagues scélérates y balaient les rochers par beau temps, et les pêcheurs du bord y meurent chaque année. Ne pêchez jamais dos à la mer sur une pointe, et par houle de plus de 2 m, restez dans la ria.',
  },
  cantabria: {
    slug: 'cantabria',
    titre: 'Pêcher du bord en Cantabrie',
    accroche:
      'La baie de Santander et sa barre de Somo : une plage de sable face à l’Atlantique, protégée par la baie, et les falaises de la côte cantabrique de part et d’autre. Le bar y chasse dans le ressac dès que la mer se forme.',
    terrain:
      'Sable dans la baie, roche sur les pointes. Marnage de 3 à 4 m : la barre de Somo se pêche à la montante, quand l’eau recouvre les bancs et que le courant de la baie s’inverse. Surfcasting et lancer-ramener ; lubina, sar, daurade.',
    conseil:
      'À l’entrée de la baie, le courant de marée est violent à mi-marée et emporte tout ce qui n’est pas lesté lourd. Les plombs grappins sont la règle, et l’étale de pleine mer la fenêtre confortable pour débuter.',
  },
  'pais-vasco': {
    slug: 'pais-vasco',
    titre: 'Pêcher du bord au Pays basque',
    accroche:
      'Zarautz et sa longue plage entre deux caps : le Pays basque espagnol reçoit la houle du golfe de Gascogne sur des plages de sable encadrées de falaises. Une côte de surf, donc une côte de bar.',
    terrain:
      'Sable dans les baies, roche et flysch sur les caps. Marnage de 3 à 4 m. Le surfcasting sur la plage par mer formée, le lancer-ramener depuis les rochers des caps au lever du jour. Lubina, sar, daurade ; le maquereau et le chinchard passent en été.',
    conseil:
      'Le flysch — ces couches de roche inclinées — est glissant et coupant, et la houle y monte par les failles. Un cap pêchable par 1 m ne l’est plus par 1,5 m. Regardez la période : une longue houle du nord-ouest y est plus dangereuse qu’une mer de vent courte.',
  },
  andalucia: {
    slug: 'andalucia',
    titre: 'Pêcher du bord en Andalousie',
    accroche:
      'Du golfe de Cadix au Cabo de Gata, l’Andalousie a deux mers et deux pêches : les grandes plages atlantiques de Huelva et de la Costa de la Luz, avec leur marée, et la Méditerranée d’Almería, claire et presque immobile. Tarifa, au milieu, est le point où elles se rencontrent.',
    terrain:
      'Sable fin et pente douce sur l’Atlantique, marnage de 2 à 3 m ; roche volcanique et eau transparente au Cabo de Gata, sans marée. Surfcasting à Matalascañas et El Palmar, rockfishing et pêche au flotteur à Gata. Daurade, sar, marbré, lubina ; la sole sur le sable de Huelva.',
    conseil:
      'Le levante, vent d’est du détroit, souffle plusieurs jours de suite et rend Tarifa impêchable tout en laissant Huelva praticable ; le poniente fait l’inverse. Choisissez le spot d’après le vent prévu, pas d’après la distance.',
  },
  catalunya: {
    slug: 'catalunya',
    titre: 'Pêcher du bord en Catalogne',
    accroche:
      'Le delta de l’Èbre et les plages au sud de Barcelone : une Méditerranée de sable, d’étangs et d’embouchures, sans marée, où la daurade et le loup viennent chercher au bord ce que le fleuve apporte.',
    terrain:
      'Sable fin partout, fonds propres et peu profonds, marnage de quelques dizaines de centimètres. Le surfcasting léger et la pêche à soutenir sur ver, bibi et crabe ; le lancer-ramener aux embouchures du delta, où l’eau douce et l’eau salée se mêlent. Daurade, loup, sar, marbré.',
    conseil:
      'Sur le delta, les bancs de sable changent à chaque coup de mer et l’eau trouble du fleuve peut s’étendre sur des kilomètres après une crue : c’est là que la daurade fouille. Le lendemain d’un coup de vent d’est, l’embouchure vaut le déplacement.',
  },
};

export function ficheRegionDe(slug: string): FicheRegion {
  const fiche = FICHES_REGIONS[slug];
  if (!fiche) throw new Error(`Aucune fiche pour la région « ${slug} »`);
  return fiche;
}

export interface RegionCatalogue {
  slug: string;
  nom: string;
  pays: PaysCatalogue;
  spots: Spot[];
}

/** Toutes les régions du catalogue, dans l'ordre des pays puis des spots. */
export const REGIONS: readonly RegionCatalogue[] = Object.freeze(
  PAYS.flatMap((pays) =>
    pays.regions.map((nom) => {
      const spots = pays.spots.filter((spot) => spot.regionName === nom);
      return { slug: spots[0]?.regionSlug ?? '', nom, pays, spots };
    }),
  ),
);

export function regionDe(countrySlug: string, regionSlug: string): RegionCatalogue | null {
  return REGIONS.find((region) => region.slug === regionSlug && region.pays.slug === countrySlug) ?? null;
}

export function regionPath(countrySlug: string, regionSlug: string): string {
  return `/spots/${countrySlug}/${regionSlug}`;
}
