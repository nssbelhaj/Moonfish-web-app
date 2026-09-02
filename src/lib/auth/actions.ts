'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { catchInputSchema, spotReviewInputSchema } from '@/data/schemas';
import { localDateTimeToIso } from '@/lib/auth/local-time';
import { contributions, spots } from '@/lib/providers';
import { spotPath } from '@/lib/routes';
import { currentUser, supabaseServer } from '@/lib/supabase/server';

export interface ActionState {
  ok: boolean;
  message: string;
}

const NOT_OPEN: ActionState = {
  ok: false,
  message: 'Les comptes ne sont pas ouverts sur ce déploiement.',
};

const NOT_SIGNED_IN: ActionState = {
  ok: false,
  message: 'Session expirée. Reconnectez-vous et recommencez : votre saisie n’a pas été perdue.',
};

/**
 * Origine réelle de la requête, pour construire le lien de retour du courriel.
 *
 * On la déduit des en-têtes plutôt que d'une variable d'environnement : un
 * déploiement de prévisualisation a un domaine différent à chaque fois, et un
 * lien de connexion qui ramène en production depuis une préproduction est
 * inutilisable.
 */
async function requestOrigin(): Promise<string> {
  const list = await headers();
  const host = list.get('x-forwarded-host') ?? list.get('host') ?? 'localhost:3000';
  const protocol = list.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${protocol}://${host}`;
}

/**
 * Demande d'un lien de connexion.
 *
 * Pas de mot de passe, volontairement : ce que nous ne stockons pas ne peut
 * pas fuir, et un site de pêche n'a aucune raison de détenir un secret qu'une
 * personne réutilise peut-être ailleurs.
 */
export async function requestSignInLink(
  _previous: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const client = await supabaseServer();
  if (!client) return NOT_OPEN;

  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email)) {
    return { ok: false, message: 'Cette adresse e-mail n’est pas valide.' };
  }

  if (formData.get('consentement') !== 'oui') {
    return {
      ok: false,
      message: 'Il faut accepter la politique de confidentialité pour créer un compte.',
    };
  }

  const next = String(formData.get('next') ?? '/compte');
  const safeNext = /^\/(?!\/)[^\s]*$/.test(next) ? next : '/compte';
  const origin = await requestOrigin();

  const { error } = await client.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(safeNext)}`,
      // Le compte se crée à la première connexion : un formulaire d'inscription
      // séparé ne demanderait rien de plus et ferait une étape de plus.
      shouldCreateUser: true,
    },
  });

  if (error) {
    console.error('[auth] envoi du lien impossible', error.message);

    /*
      Deux pannes très différentes se ressemblent ici : un service momentanément
      occupé, et un projet Supabase MIS EN PAUSE — ce que le palier gratuit fait
      après sept jours sans activité. La seconde dure jusqu'à ce que quelqu'un
      relance le projet, et « réessayez dans un instant » serait alors une
      indication fausse, qui ferait douter la personne de son adresse.

      On ne peut pas distinguer les deux de façon fiable depuis ici, alors on
      n'annonce aucun délai. Le détail part dans les journaux, où il est utile ;
      /api/keep-alive, lui, nomme explicitement la pause.
    */
    return {
      ok: false,
      message:
        'Le service de comptes ne répond pas. Ce n’est pas votre adresse : réessayez plus tard.',
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
  const client = await supabaseServer();
  if (client) await client.auth.signOut();
  redirect('/compte');
}

/** Création du profil : le nom affiché et la trace du consentement. */
export async function createProfile(
  _previous: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const user = await currentUser();
  if (!user) return NOT_SIGNED_IN;

  const result = await contributions.createProfile(
    user.id,
    String(formData.get('display_name') ?? ''),
  );

  if (!result.ok) return { ok: false, message: result.message };

  revalidatePath('/compte');
  return { ok: true, message: `Profil créé. Vos contributions s’afficheront sous « ${result.data.displayName} ».` };
}

export async function renameProfile(
  _previous: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const user = await currentUser();
  if (!user) return NOT_SIGNED_IN;

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
async function spotSpeciesPath(formData: FormData): Promise<string | null> {
  const path = String(formData.get('spot_path') ?? '');
  if (/^\/spots\/[a-z0-9-]+\/[a-z0-9-]+\/[a-z0-9-]+$/.test(path)) return `${path}/especes`;

  const slug = String(formData.get('spot_slug') ?? '');
  if (!/^[a-z0-9-]+$/.test(slug)) return null;

  const spot = await spots.findBySlug(slug);
  return spot ? `${spotPath(spot)}/especes` : null;
}

export async function saveReview(
  _previous: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const user = await currentUser();
  if (!user) return NOT_SIGNED_IN;

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

  const path = await spotSpeciesPath(formData);
  if (path) revalidatePath(path);

  return { ok: true, message: 'Avis enregistré. Merci : c’est ce qui remplit la partie que les modèles ne savent pas dire.' };
}

export async function deleteReview(formData: FormData): Promise<void> {
  const user = await currentUser();
  if (!user) return;

  await contributions.deleteReview(String(formData.get('review_id') ?? ''));

  const path = await spotSpeciesPath(formData);
  if (path) revalidatePath(path);
  revalidatePath('/compte');
}

export async function addCatch(
  _previous: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const user = await currentUser();
  if (!user) return NOT_SIGNED_IN;

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
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'Déclaration invalide.' };
  }

  const result = await contributions.addCatch(parsed.data, {
    userId: user.id,
    displayName: profile.displayName,
  });

  if (!result.ok) return { ok: false, message: result.message };

  const path = await spotSpeciesPath(formData);
  if (path) revalidatePath(path);

  return { ok: true, message: 'Prise enregistrée.' };
}

export async function deleteCatch(formData: FormData): Promise<void> {
  const user = await currentUser();
  if (!user) return;

  await contributions.deleteCatch(String(formData.get('catch_id') ?? ''));

  const path = await spotSpeciesPath(formData);
  if (path) revalidatePath(path);
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

  const result = await contributions.deleteAccount(user.id);
  if (!result.ok) return { ok: false, message: result.message };

  // La session est invalidée dans la foulée : laisser un cookie valide pointant
  // vers un compte effacé produirait des pages à moitié connectées.
  const client = await supabaseServer();
  if (client) await client.auth.signOut();

  redirect('/compte?efface=1');
}
