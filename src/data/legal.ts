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
  name: 'Youness BELHAJ',
  /*
    Laissé vide volontairement : édité par une personne physique, sans société
    ni association. Écrire « Éditeur individuel » suggérerait une immatriculation
    qui n'existe pas, et « entrepreneur individuel » est un statut, pas une
    description. À renseigner le jour où une structure édite le site.
  */
  legalForm: null,
  /*
    VOLONTAIREMENT ABSENTE, sous le régime de l'article 6-III-2 de la LCEN.

    Ce n'est pas un champ oublié : la dispense est explicitement revendiquée
    sur la page, qui nomme l'hébergeur détenteur de l'identité. Sans cette
    mention, l'absence d'adresse ne serait pas une dispense mais une omission.

    À RENSEIGNER le jour où `PUBLICATION_REGIME` repasse à `professionnel`.
  */
  address: null,
  email: 'contact@lunamarea.fr',
  phone: null,
  registration: null,
  vat: null,
  publicationDirector: 'Youness BELHAJ',
};

/**
 * Hébergeur.
 *
 * À vérifier si le déploiement change de plateforme : la LCEN demande le nom,
 * la dénomination sociale, l'adresse et le téléphone de l'hébergeur EFFECTIF,
 * pas de celui qu'on avait prévu.
 */
export const HOST: { name: string; address: string | null; site: string; contact: string } = {
  name: 'Hostinger International Ltd',
  /*
    Siège social publié par Hostinger. À RECOUPER avec vos factures : c'est
    l'adresse de l'hébergeur EFFECTIF que la LCEN demande, et l'entité qui
    facture peut différer selon le pays de souscription. Une adresse
    approximative vaut moins que pas d'adresse du tout — elle donne
    l'apparence de la conformité sans en avoir la substance.
  */
  address: '61 Lordou Vironos Street, 6023 Larnaca, Chypre',
  site: 'https://www.hostinger.fr',
  contact: 'https://www.hostinger.fr/contact',
};

/**
 * Régime de publication, au sens de l'article 6-III de la LCEN.
 *
 * ─── Pourquoi ce réglage existe ───────────────────────────────────────────
 *
 * La loi ne demande PAS la même chose selon qui édite :
 *
 *   · `professionnel` (alinéa 1) — identité ET adresse postale publiées. Ce
 *     régime s'impose dès qu'il y a une recette : publicité, paiement,
 *     partenariat rémunéré, affiliation. Les dons n'y suffisent pas ;
 *
 *   · `non-professionnel` (alinéa 2) — un particulier peut ne publier que le
 *     nom de l'hébergeur, à condition d'avoir communiqué son identité à
 *     celui-ci. C'est le cas dès qu'un contrat d'hébergement est signé. Le
 *     but du texte est de ne pas obliger un particulier à afficher son
 *     domicile pour tenir un site.
 *
 * Le réglage est ici plutôt que dans la page, parce qu'il ne change pas
 * seulement un affichage : il change la liste des mentions obligatoires, donc
 * ce que le bandeau d'incomplétude réclame.
 *
 * ⚠️ CE RÉGLAGE SE PÉRIME. Il est juste tant que le site ne rapporte rien, et
 * il devient FAUX le jour où il rapporte : publicité, paiement, affiliation,
 * partenariat rémunéré. Se déclarer non professionnel à tort est une
 * infraction ; publier une adresse dont on aurait pu se dispenser n'en est pas
 * une. C'est pourquoi `regime-publication.test.ts` échoue si une dépendance de
 * paiement ou de régie publicitaire apparaît alors que ce réglage vaut encore
 * `non-professionnel` : la bascule ne doit pas dépendre du souvenir qu'on en a.
 */
export type PublicationRegime = 'professionnel' | 'non-professionnel';

/*
  Choisi par l'éditeur le 2 septembre 2026 : Luna Marea n'affiche ni publicité ni
  paiement, et les dons — qu'il n'accepte pas non plus aujourd'hui — ne
  suffiraient pas à faire basculer le régime.
*/
export const PUBLICATION_REGIME: PublicationRegime = 'non-professionnel';

/**
 * Les champs sans lesquels les mentions légales ne sont pas valables.
 *
 * L'adresse en sort sous le régime non professionnel — et SEULEMENT elle :
 * le nom, le contact et le directeur de la publication restent dus dans les
 * deux cas.
 */
const REQUIRED_FIELDS = ['name', 'address', 'email', 'publicationDirector'] as const;

export function missingPublisherFields(): readonly string[] {
  return REQUIRED_FIELDS.filter((field) => {
    if (field === 'address' && PUBLICATION_REGIME === 'non-professionnel') return false;
    return PUBLISHER[field] === null;
  });
}

/**
 * Mention qui remplace l'adresse sous le régime non professionnel.
 *
 * Elle n'est pas décorative : l'alinéa 2 ne dispense de publier l'adresse
 * qu'à la condition que l'hébergeur détienne l'identité de l'éditeur. Dire
 * lequel héberge, et que l'identité lui a été communiquée, est ce qui rend la
 * dispense opposable. Sans cette phrase, la page a juste l'air incomplète.
 */
export function anonymityStatement(): string | null {
  if (PUBLICATION_REGIME !== 'non-professionnel') return null;

  return (
    `Ce site est édité à titre non professionnel. Conformément à l’article 6-III-2 ` +
    `de la loi du 21 juin 2004, l’adresse de l’éditeur n’est pas publiée : elle est ` +
    `détenue par l’hébergeur, ${HOST.name}, qui la communiquera sur réquisition ` +
    `judiciaire.`
  );
}


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
 * sont ouverts, c'est-à-dire là où une base et un envoi de courriel sont
 * configurés. La page
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
    name: 'Hostinger International Ltd',
    role: 'Hébergement du site, base de données, stockage des photos et envoi des courriels',
    data: 'Adresse IP, date, page demandée, user-agent dans les journaux de service ; adresse e-mail, nom affiché, contributions et photos dans la base',
    location: 'Union européenne',
    browserContact: true,
    scope: 'always',
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
    key: 'lunamarea-theme',
    kind: 'localStorage',
    purpose:
      'Retenir si vous avez choisi l’affichage clair ou l’affichage de nuit, pour ne pas vous éblouir au chargement suivant.',
    retention: 'Jusqu’à ce que vous effaciez les données du site dans votre navigateur.',
    consentRequired: false,
    scope: 'always',
  },
  {
    key: 'authjs.session-token',
    kind: 'cookie',
    purpose:
      'Vous garder connecté d’une page à l’autre. Il est posé à la connexion et n’existe pas tant que vous ne vous connectez pas. Il ne contient qu’un identifiant de session opaque : la session elle-même vit dans notre base, ce qui rend une déconnexion ou une suppression de compte immédiatement effective.',
    retention:
      'Trente jours, ou jusqu’à la déconnexion. Se déconnecter le supprime immédiatement.',
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
    entry: 'lunamarea-theme',
    why: 'Mémorise le thème choisi.',
  },
];

/**
 * Le cookie de session n'apparaît PAS dans la liste ci-dessus, et ce n'est pas
 * un oubli : il est posé par la bibliothèque d'authentification, dans son
 * propre code, pas dans le nôtre. Le balayage ne peut donc pas le voir.
 *
 * Il n'en est pas moins déclaré à l'utilisateur — c'est `CLIENT_STORAGE` qui
 * fait foi pour la page, et le test vérifie seulement que rien de NOTRE code
 * n'écrit dans le navigateur sans être annoncé.
 */

/** Dernière révision des deux pages légales. À dater à la main : une date automatique mentirait. */
export const LEGAL_UPDATED = '2026-09-01';

/** Autorité de contrôle compétente. */
export const CNIL = {
  name: 'Commission nationale de l’informatique et des libertés (CNIL)',
  address: '3 place de Fontenoy, TSA 80715, 75334 Paris Cedex 07',
  site: 'https://www.cnil.fr/fr/plaintes',
} as const;
