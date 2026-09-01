/**
 * Identité de l'éditeur, sous-traitants, stockages navigateur.
 *
 * Un seul fichier pour tout ce que les deux pages légales déclarent, parce que
 * la faute la plus banale de ces pages est la divergence : une adresse changée
 * dans les mentions et pas dans la politique de confidentialité, un stockage
 * ajouté dans le code et jamais déclaré nulle part. Ici, la page LIT la donnée ;
 * elle ne la recopie pas.
 *
 * ⚠️ À COMPLÉTER AVANT TOUTE MISE EN LIGNE PUBLIQUE. Les champs à `null`
 * ci-dessous sont les mentions que la loi impose (art. 6-III de la LCEN) et que
 * nous ne pouvons pas inventer à votre place : identité, adresse, contact.
 * Tant qu'ils valent `null`, les pages affichent en clair qu'elles sont
 * incomplètes plutôt que de faire semblant.
 */

export interface PublisherIdentity {
  /** Nom et prénom si vous éditez en personne physique, raison sociale sinon. */
  readonly name: string | null;
  /** « Éditeur individuel », « SAS au capital de … », « association loi 1901 »… */
  readonly legalForm: string | null;
  /** Adresse postale complète. Obligatoire, même pour un site non commercial. */
  readonly address: string | null;
  /** Adresse de contact publiée. C'est aussi celle des droits RGPD. */
  readonly email: string | null;
  /** Téléphone. Obligatoire pour un éditeur professionnel, facultatif sinon. */
  readonly phone: string | null;
  /** SIREN / SIRET, ou numéro RCS. `null` si vous n'êtes pas immatriculé. */
  readonly registration: string | null;
  /** TVA intracommunautaire, si assujetti. */
  readonly vat: string | null;
  /** Directeur de la publication : par défaut, le représentant légal. */
  readonly publicationDirector: string | null;
}

export const PUBLISHER: PublisherIdentity = {
  name: null,
  legalForm: null,
  address: null,
  email: null,
  phone: null,
  registration: null,
  vat: null,
  publicationDirector: null,
};

/** Les champs sans lesquels les mentions légales ne sont pas valables. */
const REQUIRED_FIELDS = ['name', 'address', 'email', 'publicationDirector'] as const;

export function missingPublisherFields(): readonly string[] {
  return REQUIRED_FIELDS.filter((field) => PUBLISHER[field] === null);
}

/**
 * Hébergeur.
 *
 * À vérifier si le déploiement change de plateforme : la LCEN demande le nom,
 * la dénomination sociale, l'adresse et le téléphone de l'hébergeur EFFECTIF,
 * pas de celui qu'on avait prévu.
 */
export const HOST = {
  name: 'Vercel Inc.',
  // Numéro de suite écrit en toutes lettres, sans croisillon : le test D22 lit
  // un croisillon suivi de quatre caractères comme une couleur littérale. Il a
  // raison de le faire, et l'adresse se lit aussi bien ainsi.
  address: '340 S Lemon Ave, Suite 4133, Walnut, CA 91789, États-Unis',
  site: 'https://vercel.com',
  contact: 'https://vercel.com/contact',
} as const;

/**
 * Sous-traitants et destinataires réels des données.
 *
 * `browserContact` dit si le NAVIGATEUR du visiteur parle au tiers. C'est la
 * distinction qui change tout en RGPD : nos appels météo et marée partent du
 * serveur, donc l'adresse IP du visiteur n'atteint jamais Stormglass ni
 * Open-Meteo. Écrire l'inverse par prudence serait faux, et le dire juste est
 * plus rassurant que toute formule vague.
 */
/**
 * Quand une ligne s'applique.
 *
 * `always` : sur tout déploiement. `accounts` : seulement là où les comptes
 * sont ouverts, c'est-à-dire là où un projet Supabase est configuré. La page
 * FILTRE sur ce champ plutôt que de tout afficher : décrire des comptes sur un
 * site qui n'en a pas serait aussi faux que taire ceux qui existent.
 */
export type Scope = 'always' | 'accounts';

export interface Processor {
  readonly name: string;
  readonly role: string;
  readonly data: string;
  readonly location: string;
  readonly browserContact: boolean;
  readonly scope: Scope;
}

export const PROCESSORS: readonly Processor[] = [
  {
    name: 'Vercel Inc.',
    role: 'Hébergement du site et journaux techniques',
    data: 'Adresse IP, date, page demandée, user-agent, dans les journaux de service',
    location: 'États-Unis, avec clauses contractuelles types',
    browserContact: true,
    scope: 'always',
  },
  {
    name: 'Supabase',
    role: 'Base de données des comptes, des avis et des prises ; envoi des liens de connexion ; stockage des photos',
    data: 'Adresse e-mail, nom affiché, contenu des contributions, photos. Le navigateur dialogue directement avec ce service pour la connexion et l’envoi des photos.',
    location: 'Région choisie à la création du projet — prendre une région de l’Union européenne',
    browserContact: true,
    scope: 'accounts',
  },
  {
    name: 'Stormglass AB',
    role: 'Horaires de marée',
    data: 'Aucune donnée personnelle : nous demandons des coordonnées de spot depuis notre serveur',
    location: 'Suède (Union européenne)',
    browserContact: false,
    scope: 'always',
  },
  {
    name: 'Open-Meteo',
    role: 'Vent, houle, pression, météo',
    data: 'Aucune donnée personnelle : mêmes appels, depuis notre serveur',
    location: 'Allemagne (Union européenne)',
    browserContact: false,
    scope: 'always',
  },
];

/**
 * Ce que le site écrit dans le navigateur. Aujourd'hui : une préférence
 * d'affichage, et rien d'autre.
 *
 * La liste est vérifiée par `src/lib/__tests__/privacy-claims.test.ts` : si
 * quelqu'un ajoute un stockage sans le déclarer ici, les tests tombent. C'est
 * la seule façon d'empêcher qu'une page de confidentialité devienne fausse par
 * simple oubli.
 */
export interface ClientStorageEntry {
  readonly key: string;
  readonly kind: 'localStorage' | 'sessionStorage' | 'cookie';
  readonly purpose: string;
  readonly retention: string;
  /** Un stockage strictement nécessaire ou demandé par l'utilisateur est dispensé de consentement. */
  readonly consentRequired: boolean;
  readonly scope: Scope;
}

export const CLIENT_STORAGE: readonly ClientStorageEntry[] = [
  {
    key: 'moonfish-theme',
    kind: 'localStorage',
    purpose:
      'Retenir si vous avez choisi l’affichage clair ou l’affichage de nuit, pour ne pas vous éblouir au chargement suivant.',
    retention: 'Jusqu’à ce que vous effaciez les données du site dans votre navigateur.',
    consentRequired: false,
    scope: 'always',
  },
  {
    key: 'sb-…-auth-token',
    kind: 'cookie',
    purpose:
      'Vous garder connecté d’une page à l’autre. Il est posé à la connexion et n’existe pas tant que vous ne vous connectez pas.',
    retention:
      'Jusqu’à la déconnexion, ou son expiration. Se déconnecter le supprime immédiatement.',
    // Dispensé de consentement, et ce n'est pas une facilité : un cookie
    // strictement nécessaire à un service EXPRESSÉMENT DEMANDÉ par
    // l'utilisateur — ici, rester connecté — est exempté par l'article 82 de la
    // loi Informatique et Libertés. Il ne sert à aucun suivi, aucune mesure,
    // aucune publicité, et il n'apparaît que si vous vous connectez.
    consentRequired: false,
    scope: 'accounts',
  },
];

/**
 * OÙ le code écrit dans le navigateur — la contrepartie vérifiable de la liste
 * ci-dessus.
 *
 * `src/lib/__tests__/privacy-claims.test.ts` compare cette déclaration au
 * résultat d'un balayage du dépôt : un `setItem` ou un cookie ajouté dans un
 * fichier non listé, ou en nombre différent, fait échouer les tests. C'est ce
 * qui empêche la page de confidentialité de devenir fausse par simple oubli —
 * le mode de péremption normal de ces pages.
 */
export interface StorageWriteSite {
  readonly file: string;
  /** Nombre d'écritures attendues dans ce fichier. */
  readonly writes: number;
  /** Entrée de `CLIENT_STORAGE` concernée. */
  readonly entry: string;
  readonly why: string;
}

export const CLIENT_STORAGE_WRITE_SITES: readonly StorageWriteSite[] = [
  {
    file: 'src/components/layout/ThemeToggle.tsx',
    writes: 1,
    entry: 'moonfish-theme',
    why: 'Mémorise le thème choisi.',
  },
  {
    file: 'src/middleware.ts',
    writes: 2,
    entry: 'sb-…-auth-token',
    why: 'Renouvelle le cookie de session : une fois sur la requête, une fois sur la réponse.',
  },
  {
    file: 'src/lib/supabase/server.ts',
    writes: 1,
    entry: 'sb-…-auth-token',
    why: 'Tentative d’écriture depuis un composant serveur, sans effet : c’est le middleware qui pose le cookie.',
  },
];

/** Dernière révision des deux pages légales. À dater à la main : une date automatique mentirait. */
export const LEGAL_UPDATED = '2026-09-01';

/** Autorité de contrôle compétente. */
export const CNIL = {
  name: 'Commission nationale de l’informatique et des libertés (CNIL)',
  address: '3 place de Fontenoy, TSA 80715, 75334 Paris Cedex 07',
  site: 'https://www.cnil.fr/fr/plaintes',
} as const;
