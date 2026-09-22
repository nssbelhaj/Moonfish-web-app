import type { Sea } from './schemas';
import { PAYS, PREPOSITIONS_PAYS, type PaysCatalogue } from './spots';

/**
 * Ce qui change RÉELLEMENT d'un pays à l'autre.
 *
 * ─── Pourquoi une fiche, et pourquoi elle est courte ─────────────────────
 *
 * Les pages pays existent pour une raison : un pêcheur de Normandie et un
 * pêcheur d'Agadir n'ont pas la même marée, pas la même réglementation, pas
 * la même saison et pas la même heure. Une page pays qui ne dirait que « voici
 * nos N spots » serait un filtre déguisé en page.
 *
 * Mais tout ce qui se CALCULE n'est pas ici : le nombre de spots, les
 * régions, les espèces les plus citées, les scores du moment viennent du
 * catalogue et des prévisions. Cette fiche ne contient que ce qu'aucun calcul
 * ne donne — le régime de marée, la règle du jeu, le danger propre au lieu.
 *
 * ─── Ce qu'elle refuse d'affirmer ────────────────────────────────────────
 *
 * Aucune taille minimale ni quota chiffré pour l'Espagne et le Maroc : nos
 * données ne les couvrent pas (`MAILLE_REFERENCES` dans `species.ts`), et un
 * chiffre faux assorti d'une source a l'air vérifié. La fiche nomme
 * l'autorité et renvoie vers elle. Pour la France, elle dit ce qui est
 * stable — la marque caudale, les deux mailles du bar — et renvoie pour ce
 * qui change chaque année.
 */

export interface FacadeMaritime {
  sea: Sea;
  /** « la Manche et l’Atlantique », tel qu'on le lit dans une phrase. */
  nom: string;
  /** Une phrase sur le régime de marée de cette façade, avec un ordre de grandeur. */
  maree: string;
}

export interface FichePays {
  slug: string;
  /** Code ISO 3166-1 alpha-2, pour les données structurées. */
  iso: 'FR' | 'ES' | 'MA';
  /** « Pêcher du bord en France ». */
  titre: string;
  /** Deux phrases qui disent ce que ce pays a de particulier pour la pêche du bord. */
  accroche: string;
  facades: readonly FacadeMaritime[];
  /** La saison, telle que la pratique l'enseigne. Pas une prévision. */
  saisons: string;
  reglementation: {
    resume: string;
    autorite: string;
    url: string;
    /** Date de dernière relecture de ce paragraphe, affichée. */
    relu: string;
  };
  securite: string;
  /** Ce que l'heure locale a de particulier, s'il y a quelque chose à en dire. */
  heure: string | null;
}

export const FICHES_PAYS: Readonly<Record<string, FichePays>> = {
  france: {
    slug: 'france',
    iso: 'FR',
    titre: 'Pêcher du bord en France',
    accroche:
      'Trois mers, et trois marées qui n’ont rien à voir : la Manche découvre des kilomètres d’estran deux fois par jour, l’Atlantique roule sa houle sur les plages de sable, la Méditerranée ne bouge presque pas et se joue au vent. Le même score s’y lit, mais pas pour les mêmes raisons.',
    facades: [
      {
        sea: 'atlantique',
        nom: 'la Manche et l’Atlantique',
        maree:
          'Marées parmi les plus fortes du monde : jusqu’à 13 m de marnage en vive-eau au fond de la baie du Mont-Saint-Michel, 5 à 6 m en Bretagne, 3 à 4 m sur la côte landaise. Le coefficient y commande tout — courant, estran, heure de pêche.',
      },
      {
        sea: 'mediterranee',
        nom: 'la Méditerranée',
        maree:
          'Marnage de quelques dizaines de centimètres : le coefficient ne dit presque rien ici. Ce sont le vent, la pression et la houle de vent qui font ou défont une sortie — et c’est ce que le score pèse.',
      },
    ],
    saisons:
      'Le bar se cherche du printemps à l’automne, avec deux pics — mai-juin et septembre-novembre — et se raréfie près du bord en plein hiver. L’hiver reste la saison du merlan, de la plie et du congre en Manche. La sole se prend surtout de nuit, d’avril à octobre, sur le sable.',
    reglementation: {
      resume:
        'Le bar a deux tailles minimales : 42 cm en Manche, mer du Nord et Atlantique, 30 cm en Méditerranée. Toute prise de bar, dorade royale, lieu jaune, maigre ou thon rouge conservée doit être marquée à la nageoire caudale. Le quota journalier de bar en Atlantique est révisé chaque année par l’Union européenne : vérifiez-le avant de garder un poisson.',
      autorite: 'ministère de la Mer',
      url: 'https://www.mer.gouv.fr/peche-de-loisir-en-mer',
      relu: '2026-09-22',
    },
    securite:
      'En Manche, la marée monte plus vite qu’on ne marche sur un estran plat : on se fait encercler par une baie qui se remplit. Sur l’Atlantique, les baïnes des plages landaises et girondines aspirent vers le large à marée descendante. En Méditerranée, mistral et tramontane se lèvent en une heure.',
    heure: null,
  },
  espagne: {
    slug: 'espagne',
    iso: 'ES',
    titre: 'Pêcher du bord en Espagne',
    accroche:
      'Le nord et le sud ne se ressemblent pas. De la Galice au Pays basque, la côte cantabrique reçoit la houle atlantique de plein fouet sur des falaises et des rias ; en Catalogne et en Andalousie, la Méditerranée ne connaît ni marée ni ressac, et tout se décide au vent.',
    facades: [
      {
        sea: 'atlantique',
        nom: 'la côte cantabrique et la Galice',
        maree:
          'Marnage de 3 à 4 m en vive-eau : de vraies marées, moins amples qu’en Manche mais qui vident et remplissent les rias galiciennes. Le coefficient garde tout son sens.',
      },
      {
        sea: 'mediterranee',
        nom: 'la Catalogne et l’Andalousie',
        maree:
          'Marnage inférieur à 40 cm. Le coefficient n’a presque aucune prise ; le levant et la tramontane, si.',
      },
    ],
    saisons:
      'Au nord, le bar (lubina) et le sar donnent du printemps à l’automne, et la côte reste pêchable l’hiver entre deux coups de houle. En Méditerranée, la daurade royale et le sar se cherchent surtout de la fin de l’été à l’automne, quand l’eau se rafraîchit.',
    reglementation: {
      resume:
        'Une licence de pêche maritime récréative est exigée, délivrée par chaque communauté autonome — Galice, Cantabrie, Pays basque, Catalogne, Andalousie ont chacune la leur. Les tailles minimales relèvent du ministère espagnol : nous n’en affichons aucune tant que nous ne les avons pas vérifiées.',
      autorite: 'ministère espagnol de l’Agriculture et de la Pêche (MAPA)',
      url: 'https://www.mapa.gob.es/es/pesca/temas/control-inspeccion-lucha-pesca-ilegal/informacion-sobre-actividad-pesquera/detalle/buscador_especies',
      relu: '2026-09-22',
    },
    securite:
      'Sur la côte cantabrique, la houle atlantique balaie les plates-formes rocheuses sans prévenir, y compris par beau temps : une vague sur dix suffit. En Méditerranée, le levant lève une mer courte et brune en quelques heures.',
    heure: null,
  },
  maroc: {
    slug: 'maroc',
    iso: 'MA',
    titre: 'Pêcher du bord au Maroc',
    accroche:
      'Trois mille kilomètres de côte atlantique ouverts plein ouest, et une Méditerranée tranquille au nord. L’Atlantique marocain, c’est la houle du large qui arrive sans obstacle, une eau qui reste entre 16 et 22 °C toute l’année, et des postes rocheux qui pêchent en hiver quand la France ne pêche plus.',
    facades: [
      {
        sea: 'atlantique',
        nom: 'l’Atlantique, de Tanger à Dakhla',
        maree:
          'Marnage de 2,5 à 3,5 m en vive-eau : des marées franches, qui découvrent les plates-formes rocheuses et rythment la journée. Le coefficient se lit comme en France, avec une amplitude moindre.',
      },
      {
        sea: 'mediterranee',
        nom: 'la Méditerranée, d’Al Hoceïma à Saïdia',
        maree:
          'Marnage de quelques dizaines de centimètres. Ici c’est le vent d’est, le chergui, qui commande.',
      },
    ],
    saisons:
      'L’Atlantique marocain se pêche toute l’année : le loup et le sar tiennent le bord en hiver, la courbine et la daurade royale remontent du printemps à l’automne, et la bonite passe en fin d’été. L’hiver est la saison des grosses houles de nord-ouest, qui ferment les postes exposés plusieurs jours de suite.',
    reglementation: {
      resume:
        'La pêche de loisir depuis le rivage est encadrée par le département de la Pêche maritime : permis, tailles minimales et quotas journaliers y sont fixés, et ils diffèrent des règles françaises. Nous n’affichons aucun chiffre que nous n’avons pas vérifié : renseignez-vous auprès de la délégation locale avant de conserver une prise.',
      autorite: 'département de la Pêche maritime du Maroc',
      url: 'http://www.mpm.gov.ma/',
      relu: '2026-09-22',
    },
    securite:
      'La houle atlantique arrive du large sans rien pour l’amortir : une plate-forme rocheuse sèche peut être balayée par une série sans que la mer ait paru grossir. Les courants de retour sont puissants sur les plages ouvertes. Ne pêchez jamais dos à la mer.',
    heure:
      'Le Maroc vit à l’heure UTC+1 toute l’année, sauf pendant le ramadan où il repasse à UTC : les horaires affichés ici suivent ce changement, une montre réglée depuis la France ne le fait pas.',
  },
};

/** Fiche d'un pays du catalogue. Lève si elle manque : c'est un oubli, pas un cas. */
export function ficheDe(slug: string): FichePays {
  const fiche = FICHES_PAYS[slug];
  if (!fiche) throw new Error(`Aucune fiche pour le pays « ${slug} »`);
  return fiche;
}

export function paysDe(slug: string): PaysCatalogue | null {
  return PAYS.find((pays) => pays.slug === slug) ?? null;
}

/** « en France », « au Maroc ». */
export function prepositionDe(pays: Pick<PaysCatalogue, 'slug' | 'nom'>): string {
  return PREPOSITIONS_PAYS[pays.slug] ?? `en ${pays.nom}`;
}

/** Chemin de la page pays. */
export function paysPath(slug: string): string {
  return `/spots/${slug}`;
}

/**
 * Les espèces les plus citées par les spots d'un pays, avec le nombre de
 * spots qui les nomment. Dérivé du catalogue : jamais une liste écrite à la
 * main qui vieillirait au premier spot ajouté.
 */
export function especesPhares(
  pays: PaysCatalogue,
  combien = 6,
): { nom: string; spots: number }[] {
  const compte = new Map<string, number>();
  for (const spot of pays.spots) {
    for (const espece of spot.species) compte.set(espece, (compte.get(espece) ?? 0) + 1);
  }
  return [...compte]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'fr'))
    .slice(0, combien)
    .map(([nom, spots]) => ({ nom, spots }));
}
