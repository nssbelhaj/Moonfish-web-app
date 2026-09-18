'use server';

import { AuthError } from 'next-auth';
import { revalidatePath } from 'next/cache';

import { visibilitySchema } from '@/data/schemas';
import { profilInitialSchema } from '@/data/schemas-compte';
import { redirect } from 'next/navigation';

import { signIn, signOut as authSignOut } from '@/auth';
import { accountsEnabled } from '@/lib/auth/config';
import { catchInputSchema, outingInputSchema, spotReviewInputSchema } from '@/data/schemas';
import { localDateTimeToIso } from '@/lib/auth/local-time';
import { currentUser } from '@/lib/auth/session';
import { BUDGETS, consommer, delaiLisible, ipAppelante, rembourser } from '@/lib/limites';
import { contributions, spots } from '@/lib/providers';
import { spotPath } from '@/lib/routes';

export interface ActionState {
  ok: boolean;
  message: string;
}

const NOT_OPEN: ActionState = {
  ok: false,
  message: 'Les comptes ne sont pas ouverts sur ce déploiement.',
};

/**
 * Un compteur injoignable ne se dit pas comme un dépassement.
 *
 * Les deux refusent. Mais annoncer « réessayez dans 15 minutes » quand la
 * table des compteurs n'existe pas envoie attendre pour rien, indéfiniment :
 * au retour, le même refus, le même délai. La cause est un déploiement
 * incomplet, pas un abus, et elle doit se nommer.
 */
const COMPTEUR_EN_PANNE: ActionState = {
  ok: false,
  message:
    'Le compteur de sécurité ne répond pas — la base est joignable mais incomplète. Ce n’est ni votre adresse ni un excès de demandes : les migrations n’ont probablement pas été appliquées au déploiement.',
};

const NOT_SIGNED_IN: ActionState = {
  ok: false,
  message: 'Session expirée. Reconnectez-vous et recommencez : votre saisie n’a pas été perdue.',
};

/**
 * Budget d'écriture d'un compte connecté.
 *
 * Rend `null` quand la place est libre, un refus prêt à renvoyer sinon.
 *
 * Les suppressions ne le consomment pas : elles exigent de posséder la ligne
 * visée, ce qui borne déjà le dégât à ses propres données. Ce budget vise les
 * écritures qui CRÉENT — un script qui remplirait la base d'avis.
 */
async function budgetEcriture(userId: string): Promise<ActionState | null> {
  const decision = await consommer(BUDGETS.contribution, userId);
  if (decision.allowed) return null;
  if (decision.panne) return COMPTEUR_EN_PANNE;

  return {
    ok: false,
    message: `Trop d’enregistrements d’affilée. Réessayez dans ${delaiLisible(decision.resetAt)}.`,
  };
}

/**
 * Demande d'un lien de connexion.
 *
 * Pas de mot de passe : ce que nous ne stockons pas ne peut pas fuir.
 */
export async function requestSignInLink(
  _previous: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  if (!accountsEnabled()) return NOT_OPEN;

  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase();

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email)) {
    return { ok: false, message: 'Cette adresse e-mail n’est pas valide.' };
  }

  if (formData.get('consentement') !== 'oui') {
    return {
      ok: false,
      message: 'Il faut accepter la politique de confidentialité pour créer un compte.',
    };
  }

  /*
    ── Les trois budgets, dans cet ordre ────────────────────────────────────

    C'est le seul formulaire du site qui, SANS authentification, fait partir
    un courriel vers une adresse fournie par l'appelant. Il n'avait aucune
    limite.

    L'ordre n'est pas indifférent : on ne consomme le budget global qu'après
    avoir écarté les deux abus locaux, sinon un seul script épuiserait pour
    tout le monde un compteur qu'il n'aurait jamais dû atteindre.

    Le message ne dit jamais si l'adresse est connue : la réponse doit rester
    la même que le compte existe ou non, y compris quand elle refuse.
  */
  const parAdresse = await consommer(BUDGETS.connexionAdresse, email);
  if (parAdresse.panne) return COMPTEUR_EN_PANNE;
  if (!parAdresse.allowed) {
    /*
      Le message ne dit PAS « un lien a déjà été envoyé ».

      Il le disait, et c'était faux dans le cas qui compte : quand l'envoi
      échoue, les tentatives sont refusées après trois essais, et la personne
      partait fouiller ses indésirables à la recherche d'un courriel jamais
      parti. Le budget est maintenant remboursé quand l'envoi échoue, mais le
      message reste prudent — il constate des demandes, il ne promet pas un
      envoi.
    */
    return {
      ok: false,
      message: `Trop de demandes pour cette adresse. Réessayez dans ${delaiLisible(parAdresse.resetAt)}. Si rien n’arrive, ce n’est pas votre adresse : signalez-le.`,
    };
  }

  const ip = await ipAppelante();
  const parIp = await consommer(BUDGETS.connexionIp, ip);
  if (parIp.panne) return COMPTEUR_EN_PANNE;
  if (!parIp.allowed) {
    return {
      ok: false,
      message: `Trop de demandes de connexion depuis cet accès. Réessayez dans ${delaiLisible(parIp.resetAt)}.`,
    };
  }

  const global = await consommer(BUDGETS.connexionGlobal, 'site');
  if (global.panne) return COMPTEUR_EN_PANNE;
  if (!global.allowed) {
    console.warn('[auth] plafond horaire d’envoi atteint pour tout le site');
    return {
      ok: false,
      message: `Le service de connexion a atteint sa limite d’envoi pour l’heure. Ce n’est pas votre adresse : réessayez dans ${delaiLisible(global.resetAt)}.`,
    };
  }

  const next = String(formData.get('next') ?? '/compte');
  const safeNext = /^\/(?!\/)[^\s]*$/.test(next) ? next : '/compte';

  try {
    // `redirect: false` : on veut rendre notre propre message plutôt que de
    // laisser la bibliothèque naviguer. Le formulaire reste à l'écran, avec la
    // saisie intacte si quelque chose échoue.
    await signIn('nodemailer', { email, redirectTo: safeNext, redirect: false });
  } catch (error) {
    if (error instanceof AuthError) {
      console.error('[auth] envoi du lien impossible', error.type, error.message);
    } else {
      console.error('[auth] envoi du lien impossible', error);
    }

    /*
      On n'annonce AUCUN délai. Deux pannes très différentes se ressemblent
      ici — un serveur d'envoi momentanément occupé, et une configuration SMTP
      fausse qui durera jusqu'à correction. Promettre « réessayez dans un
      instant » dans le second cas ferait douter la personne de son adresse.
    */
    /*
      L'envoi a échoué : la personne n'a rien reçu, elle ne doit rien avoir
      payé. Sans ce remboursement, trois pannes d'affilée la bloquent un quart
      d'heure — et le message de blocage masque alors la vraie panne.
    */
    await Promise.all([
      rembourser(BUDGETS.connexionAdresse, email),
      rembourser(BUDGETS.connexionIp, ip),
      rembourser(BUDGETS.connexionGlobal, 'site'),
    ]);

    return {
      ok: false,
      message: 'Le service de connexion ne répond pas. Ce n’est pas votre adresse : réessayez plus tard.',
    };
  }

  /*
    Réponse IDENTIQUE que l'adresse existe ou non. Écrire « compte inconnu »
    transformerait ce formulaire en outil de vérification d'adresses : n'importe
    qui pourrait savoir si telle personne a un compte ici.
  */
  return {
    ok: true,
    message:
      'Si cette adresse peut recevoir du courrier, un lien de connexion vient d’y être envoyé. Il est valable une heure et ne sert qu’une fois.',
  };
}

export async function signOut(): Promise<void> {
  await authSignOut({ redirectTo: '/compte' });
}

/** Création du profil : le nom affiché et la trace du consentement. */
export async function createProfile(
  _previous: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const user = await currentUser();
  if (!user) return NOT_SIGNED_IN;

  const trop = await budgetEcriture(user.id);
  if (trop) return trop;

  // Même seuil d'âge et même consentement que l'inscription par mot de
  // passe : ce chemin — Google, lien courriel — n'y passait pas.
  const analyse = profilInitialSchema.safeParse({
    displayName: formData.get('display_name'),
    birthDate: formData.get('birth_date'),
    consentement: formData.get('consentement'),
  });
  if (!analyse.success) {
    return { ok: false, message: analyse.error.issues[0]?.message ?? 'Profil incomplet.' };
  }

  const result = await contributions.createProfile(user.id, analyse.data.displayName, {
    birthDate: analyse.data.birthDate,
  });

  if (!result.ok) return { ok: false, message: result.message };

  revalidatePath('/compte');
  return {
    ok: true,
    message: `Profil créé. Vos contributions s’afficheront sous « ${result.data.displayName} ».`,
  };
}

export async function renameProfile(
  _previous: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const user = await currentUser();
  if (!user) return NOT_SIGNED_IN;

  const trop = await budgetEcriture(user.id);
  if (trop) return trop;

  const result = await contributions.renameProfile(
    user.id,
    String(formData.get('display_name') ?? ''),
  );

  if (!result.ok) return { ok: false, message: result.message };

  revalidatePath('/compte');
  return {
    ok: true,
    // Dit tout de suite ce que le changement ne fait pas : les anciennes
    // contributions gardent le nom sous lequel elles ont été publiées.
    message:
      'Nom mis à jour. Vos contributions déjà publiées gardent le nom qu’elles portaient : elles en conservent une copie.',
  };
}

/**
 * Chemin de la page d'espèces d'un spot, pour la revalidation après écriture.
 *
 * Deux entrées possibles, parce que les suppressions viennent de deux endroits :
 * le champ caché `spot_path` quand on écrit depuis la page du spot, et le seul
 * `spot_slug` quand on supprime depuis l'écran de compte. Sans ce second
 * chemin, une contribution supprimée restait visible jusqu'à une heure sur la
 * page publique — un effacement qui se fait attendre n'est pas un effacement.
 */
/**
 * Les pages d'un spot à régénérer après une contribution.
 *
 * ─── Toutes, et pas seulement « Espèces » ─────────────────────────────────
 *
 * Cette fonction ne rendait que `/especes`, du temps où avis et prises y
 * vivaient ensemble. Les avis sont remontés sur la page principale du spot,
 * qui est pré-rendue avec `revalidate = 3600` : publier un avis ne le
 * montrait donc plus AVANT UNE HEURE. Le formulaire répondait « Avis
 * enregistré », la page restait vide, et rien n'était en panne — la donnée
 * était bien en base. Mesuré au navigateur ; aucun test unitaire ne pouvait
 * le voir, puisque le défaut est dans ce qu'on oublie de régénérer.
 *
 * On rend donc les deux chemins. Régénérer une page qui n'a pas changé ne
 * coûte qu'un rendu ; en oublier une la fige pour une heure.
 */
async function spotPathsToRevalidate(formData: FormData): Promise<string[]> {
  const fourni = String(formData.get('spot_path') ?? '');
  const base = /^\/spots\/[a-z0-9-]+\/[a-z0-9-]+\/[a-z0-9-]+$/.test(fourni)
    ? fourni
    : await (async () => {
        const slug = String(formData.get('spot_slug') ?? '');
        if (!/^[a-z0-9-]+$/.test(slug)) return null;
        const spot = await spots.findBySlug(slug);
        return spot ? spotPath(spot) : null;
      })();

  return base === null ? [] : [base, `${base}/especes`];
}

export async function saveReview(
  _previous: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const user = await currentUser();
  if (!user) return NOT_SIGNED_IN;

  const trop = await budgetEcriture(user.id);
  if (trop) return trop;

  const profile = await contributions.getProfile(user.id);
  if (!profile) {
    return { ok: false, message: 'Choisissez d’abord un nom affiché, sur la page de votre compte.' };
  }

  const parsed = spotReviewInputSchema.safeParse({
    spotSlug: formData.get('spot_slug'),
    rating: formData.get('rating'),
    comment: formData.get('comment') ?? '',
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'Avis invalide.' };
  }

  const result = await contributions.saveReview(parsed.data, {
    userId: user.id,
    displayName: profile.displayName,
  });

  if (!result.ok) return { ok: false, message: result.message };

  for (const chemin of await spotPathsToRevalidate(formData)) revalidatePath(chemin);

  return {
    ok: true,
    message: 'Avis enregistré. Merci : c’est ce qui remplit la partie que les modèles ne savent pas dire.',
  };
}

export async function deleteReview(formData: FormData): Promise<void> {
  const user = await currentUser();
  if (!user) return;

  // L'identifiant du propriétaire part avec la requête : c'est lui qui tient
  // lieu, en MySQL, de la politique de sécurité que PostgreSQL appliquait.
  await contributions.deleteReview(String(formData.get('review_id') ?? ''), user.id);

  for (const chemin of await spotPathsToRevalidate(formData)) revalidatePath(chemin);
  revalidatePath('/compte');
}

export async function addCatch(
  _previous: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const user = await currentUser();
  if (!user) return NOT_SIGNED_IN;

  const trop = await budgetEcriture(user.id);
  if (trop) return trop;

  const profile = await contributions.getProfile(user.id);
  if (!profile) {
    return { ok: false, message: 'Choisissez d’abord un nom affiché, sur la page de votre compte.' };
  }

  /*
    La date arrive du formulaire au format « 2026-09-01T18:30 », sans fuseau.
    L'interpréter en UTC décalerait la prise de deux heures en été. On la lit
    donc comme une heure LOCALE au navigateur, dont le décalage est transmis en
    minutes par un champ caché.
  */
  const localValue = String(formData.get('caught_at') ?? '');
  const offsetMinutes = Number(formData.get('tz_offset') ?? '0');
  const caughtAt = localDateTimeToIso(localValue, Number.isFinite(offsetMinutes) ? offsetMinutes : 0);

  if (caughtAt === null) return { ok: false, message: 'Date de prise invalide.' };
  if (new Date(caughtAt).getTime() > Date.now() + 60_000) {
    return { ok: false, message: 'Une prise ne peut pas être datée dans le futur.' };
  }

  const parsed = catchInputSchema.safeParse({
    spotSlug: formData.get('spot_slug'),
    species: formData.get('species'),
    lengthCm: formData.get('length_cm') ?? '',
    weightG: formData.get('weight_g') ?? '',
    released: formData.get('released') === 'oui',
    caughtAt,
    note: formData.get('note') ?? '',
    photoPath: (formData.get('photo_path') as string | null) || null,
    /*
      Une case décochée n'est PAS envoyée par le navigateur : `get` rend
      alors `null`, et le défaut du schéma — « privée » — s'applique. C'est
      exactement le comportement voulu, mais il faut encore lire le champ
      pour que la case COCHÉE serve à quelque chose. Oubli mesuré au
      navigateur : la case était bien là, cochée, et toutes les prises
      arrivaient privées.
    */
    visibility: formData.get('visibility') ?? undefined,
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'Déclaration invalide.' };
  }

  const result = await contributions.addCatch(parsed.data, {
    userId: user.id,
    displayName: profile.displayName,
  });

  if (!result.ok) return { ok: false, message: result.message };

  for (const chemin of await spotPathsToRevalidate(formData)) revalidatePath(chemin);
  // Le carnet vit sur la page de compte : une prise déclarée depuis le carnet
  // lui-même doit y apparaître sans que la personne ait à recharger.
  revalidatePath('/compte');

  return { ok: true, message: 'Prise enregistrée.' };
}

/**
 * Publier une prise, ou la reprendre.
 *
 * Un formulaire par prise, avec la visibilité VOULUE en champ caché — pas une
 * bascule qui lirait l'état courant côté serveur. Deux onglets ouverts sur le
 * même carnet inverseraient sinon le réglage l'un après l'autre, et le
 * dernier clic ne dirait plus ce qu'il affiche.
 */
export async function setCatchVisibility(formData: FormData): Promise<void> {
  const user = await currentUser();
  if (!user) return;

  const voulue = visibilitySchema.safeParse(formData.get('visibility'));
  if (!voulue.success) return;

  await contributions.setCatchVisibility(
    String(formData.get('catch_id') ?? ''),
    user.id,
    voulue.data,
  );

  for (const chemin of await spotPathsToRevalidate(formData)) revalidatePath(chemin);
  revalidatePath('/compte');
}

export async function deleteCatch(formData: FormData): Promise<void> {
  const user = await currentUser();
  if (!user) return;

  await contributions.deleteCatch(String(formData.get('catch_id') ?? ''), user.id);

  for (const chemin of await spotPathsToRevalidate(formData)) revalidatePath(chemin);
  revalidatePath('/compte');
}

/**
 * Effacement du compte.
 *
 * Deux garde-fous, et aucun n'est décoratif : la personne doit RECOPIER un mot,
 * et la suppression est irréversible parce qu'elle emporte les contributions.
 * Un bouton seul, à côté d'un bouton « se déconnecter », se clique par erreur.
 */
export async function deleteAccount(
  _previous: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const user = await currentUser();
  if (!user) return NOT_SIGNED_IN;

  if (String(formData.get('confirmation') ?? '').trim().toLowerCase() !== 'supprimer') {
    return { ok: false, message: 'Recopiez le mot « supprimer » pour confirmer.' };
  }

  /*
    Les spots concernés sont relevés AVANT la suppression : après, les lignes
    n'existent plus et on ne saurait plus quelles pages rafraîchir.

    Sans cela, les données étaient bien effacées de la base mais restaient
    AFFICHÉES jusqu'à une heure sur les pages de spot, qui sont pré-rendues.
    Mesuré en conditions réelles : compte supprimé, base vide, avis toujours
    visible. Un effacement qui se voit encore n'est pas un effacement, et
    c'est la seule partie du droit à l'oubli que l'utilisateur constate.
  */
  const mine = await contributions.listForUser(user.id);
  const touchedSlugs = new Set([
    ...mine.reviews.map((review) => review.spotSlug),
    ...mine.catches.map((entry) => entry.spotSlug),
  ]);

  const result = await contributions.deleteAccount(user.id);
  if (!result.ok) return { ok: false, message: result.message };

  for (const slug of touchedSlugs) {
    const spot = await spots.findBySlug(slug);
    if (spot) revalidatePath(`${spotPath(spot)}/especes`);
  }

  /*
    La session vit EN BASE et part avec l'utilisateur, par cascade : elle est
    donc déjà caduque à cet instant. On efface tout de même le cookie, pour que
    le navigateur cesse d'envoyer un jeton qui ne désigne plus rien.
  */
  await authSignOut({ redirect: false });
  redirect('/compte?efface=1');
}

/* ────────────────────────────────────────────────────────────────────────────
   Favoris.

   Un favori n'est pas une contribution : il ne demande pas de nom affiché, il
   n'est vu par personne d'autre, et il ne revalide aucune page publique. Il
   est donc accessible dès la connexion, avant même le choix du profil.
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * Les favoris ne consomment aucun budget, et ce n'est pas un oubli.
 *
 * La clé primaire composée (personne, spot) borne la table à une ligne par
 * spot et par personne — une douzaine au total aujourd'hui. Marteler ce
 * bouton ne fait donc grossir aucune table : un limiteur n'y protégerait
 * rien, et gênerait quelqu'un qui trie ses spots.
 */
export async function toggleFavorite(
  _previous: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const user = await currentUser();
  if (!user) return NOT_SIGNED_IN;

  const slug = String(formData.get('spot_slug') ?? '');
  const wanted = formData.get('favori') === 'oui';

  const result = wanted
    ? await contributions.addFavorite(user.id, slug)
    : await contributions.removeFavorite(user.id, slug);

  if (!result.ok) return { ok: false, message: result.message };

  revalidatePath('/compte');
  return {
    ok: true,
    message: wanted ? 'Ajouté à vos favoris.' : 'Retiré de vos favoris.',
  };
}

/* ────────────────────────────────────────────────────────────────────────────
   Sorties programmées.
   ──────────────────────────────────────────────────────────────────────────── */

export async function addOuting(
  _previous: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const user = await currentUser();
  if (!user) return NOT_SIGNED_IN;

  const trop = await budgetEcriture(user.id);
  if (trop) return trop;

  // Même lecture d'heure locale que pour une prise : le navigateur transmet
  // son décalage, et l'instant est stocké en UTC.
  const localValue = String(formData.get('planned_at') ?? '');
  const offsetMinutes = Number(formData.get('tz_offset') ?? '0');
  const plannedAt = localDateTimeToIso(localValue, Number.isFinite(offsetMinutes) ? offsetMinutes : 0);

  if (plannedAt === null) return { ok: false, message: 'Date de sortie invalide.' };
  if (new Date(plannedAt).getTime() < Date.now() - 60_000) {
    return { ok: false, message: 'Une sortie se programme dans le futur.' };
  }
  if (new Date(plannedAt).getTime() > Date.now() + 90 * 24 * 3_600_000) {
    return {
      ok: false,
      message: 'Au plus trois mois à l’avance : au-delà, aucune prévision n’existe pour vous alerter.',
    };
  }

  const parsed = outingInputSchema.safeParse({
    spotSlug: formData.get('spot_slug'),
    plannedAt,
    note: formData.get('note') ?? '',
    alert: formData.get('alerte') === 'oui',
    minScore: formData.get('min_score') ?? '',
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'Sortie invalide.' };
  }

  const result = await contributions.addOuting(user.id, parsed.data);
  if (!result.ok) return { ok: false, message: result.message };

  revalidatePath('/compte');
  return {
    ok: true,
    message: parsed.data.alert
      ? 'Sortie programmée. Vous recevrez les conditions prévues par courriel, la veille.'
      : 'Sortie programmée. Retrouvez-la sur votre compte.',
  };
}

export async function deleteOuting(formData: FormData): Promise<void> {
  const user = await currentUser();
  if (!user) return;

  await contributions.deleteOuting(String(formData.get('outing_id') ?? ''), user.id);
  revalidatePath('/compte');
}

