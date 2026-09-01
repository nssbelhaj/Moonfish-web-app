import {
  catchInputSchema,
  catchSchema,
  displayNameSchema,
  profileSchema,
  spotReviewInputSchema,
  spotReviewSchema,
  type Catch,
  type CatchInput,
  type Profile,
  type SpotReview,
  type SpotReviewInput,
} from '@/data/schemas';
import { CONSENT_VERSION } from '@/lib/supabase/config';
import type { CatchRow, ProfileRow, SpotReviewRow } from '@/lib/supabase/database.types';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { supabasePublic } from '@/lib/supabase/public';
import { supabaseServer, type Client } from '@/lib/supabase/server';
import type {
  AccountExport,
  Author,
  ContributionResult,
  ContributionsRepository,
  SpotContributions,
} from '../types';

/** Nombre d'éléments rendus par spot. Au-delà, la page devient un mur. */
const PAGE_SIZE = 50;

function failure<T>(
  reason: 'not-available' | 'not-authenticated' | 'invalid' | 'storage-error',
  message: string,
): ContributionResult<T> {
  return { ok: false, reason, message };
}

/**
 * Message d'erreur montrable.
 *
 * Le message brut de PostgREST cite le nom de la contrainte, la table et
 * parfois la requête. Le rendre tel quel serait à la fois illisible et
 * bavard sur la structure interne. On journalise le détail, on affiche une
 * phrase.
 */
function storageFailure<T>(context: string, error: unknown): ContributionResult<T> {
  console.error(`[contributions] ${context}`, error);
  return failure('storage-error', 'Enregistrement impossible pour le moment. Réessayez plus tard.');
}

function toReview(row: SpotReviewRow): SpotReview {
  return spotReviewSchema.parse({
    id: row.id,
    spotSlug: row.spot_slug,
    userId: row.user_id,
    authorName: row.author_name,
    rating: row.rating,
    comment: row.comment,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  });
}

function toCatch(row: CatchRow): Catch {
  return catchSchema.parse({
    id: row.id,
    spotSlug: row.spot_slug,
    userId: row.user_id,
    authorName: row.author_name,
    species: row.species,
    lengthCm: row.length_cm,
    weightG: row.weight_g,
    released: row.released,
    caughtAt: new Date(row.caught_at).toISOString(),
    note: row.note,
    photoPath: row.photo_path,
    createdAt: new Date(row.created_at).toISOString(),
  });
}

function toProfile(row: ProfileRow): Profile {
  return profileSchema.parse({
    id: row.id,
    displayName: row.display_name,
    consentVersion: row.consent_version,
    consentAt: new Date(row.consent_at).toISOString(),
    createdAt: new Date(row.created_at).toISOString(),
  });
}

/**
 * Contributions stockées dans Supabase.
 *
 * Deux choix structurants, tous deux vérifiables dans la migration SQL :
 *
 * 1. TOUTES les écritures passent par le client de session, jamais par la clé
 *    de service. C'est la sécurité au niveau des lignes qui décide qui peut
 *    écrire quoi — pas ce fichier. Un oubli de filtre ici ne peut donc pas
 *    laisser modifier l'avis d'un autre : la base refuse.
 *
 * 2. La seule exception est la suppression de compte, qui touche `auth.users`
 *    et qu'aucun utilisateur ne peut faire lui-même. Elle exige la clé de
 *    service, et on refuse explicitement plutôt que d'échouer à moitié si elle
 *    n'est pas configurée — un « compte supprimé » qui ne supprime rien serait
 *    la pire réponse possible à une demande d'effacement.
 */
export class SupabaseContributionsRepository implements ContributionsRepository {
  readonly available = true;

  readonly source = {
    name: 'Contributions des pêcheurs (Supabase)',
    kind: 'measured' as const,
    precision:
      'Avis et prises déclarés par des personnes titulaires d’un compte. Ce sont des témoignages, pas des mesures : nous ne les vérifions pas.',
  };

  private async client(): Promise<Client | null> {
    return supabaseServer();
  }

  /**
   * Avis et prises d'un spot, lus SANS session.
   *
   * Ces données sont publiques et identiques pour tout le monde : les lire avec
   * le client de session ferait basculer la page entière en rendu dynamique,
   * pour un résultat au mot près identique. La fraîcheur est assurée
   * autrement — chaque écriture révalide le chemin du spot.
   */
  async forSpot(spotSlug: string): Promise<SpotContributions> {
    const client = supabasePublic();
    if (!client) return { reviews: [], catches: [], averageRating: null, reviewCount: 0 };

    const [reviewsResult, catchesResult] = await Promise.all([
      client
        .from('spot_reviews')
        .select('*')
        .eq('spot_slug', spotSlug)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE),
      client
        .from('catches')
        .select('*')
        .eq('spot_slug', spotSlug)
        .order('caught_at', { ascending: false })
        .limit(PAGE_SIZE),
    ]);

    if (reviewsResult.error) console.error('[contributions] lecture des avis', reviewsResult.error);
    if (catchesResult.error) console.error('[contributions] lecture des prises', catchesResult.error);

    // Une panne de lecture rend une page VIDE, jamais une erreur 500 : le reste
    // de la page du spot — marée, vent, score — n'a aucune raison de tomber
    // parce que les avis sont indisponibles.
    const reviews = (reviewsResult.data ?? []).map(toReview);
    const catches = (catchesResult.data ?? []).map(toCatch);

    return {
      reviews,
      catches,
      averageRating:
        reviews.length === 0
          ? null
          : reviews.reduce((total, review) => total + review.rating, 0) / reviews.length,
      reviewCount: reviews.length,
    };
  }

  /** Contributions d'une personne, pour son écran de compte. */
  async listForUser(userId: string): Promise<{ reviews: SpotReview[]; catches: Catch[] }> {
    const client = await this.client();
    if (!client) return { reviews: [], catches: [] };

    const [reviews, catches] = await Promise.all([
      client.from('spot_reviews').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      client.from('catches').select('*').eq('user_id', userId).order('caught_at', { ascending: false }),
    ]);

    return {
      reviews: (reviews.data ?? []).map(toReview),
      catches: (catches.data ?? []).map(toCatch),
    };
  }

  async getProfile(userId: string): Promise<Profile | null> {
    const client = await this.client();
    if (!client) return null;

    const { data, error } = await client.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (error || !data) return null;

    return toProfile(data);
  }

  async createProfile(userId: string, displayName: string): Promise<ContributionResult<Profile>> {
    const client = await this.client();
    if (!client) return failure('not-available', 'Comptes indisponibles.');

    const parsed = displayNameSchema.safeParse(displayName);
    if (!parsed.success) {
      return failure('invalid', parsed.error.issues[0]?.message ?? 'Nom affiché invalide.');
    }

    const { data, error } = await client
      .from('profiles')
      .insert({ id: userId, display_name: parsed.data, consent_version: CONSENT_VERSION })
      .select('*')
      .single();

    if (error || !data) return storageFailure('création du profil', error);
    return { ok: true, data: toProfile(data) };
  }

  async renameProfile(userId: string, displayName: string): Promise<ContributionResult<Profile>> {
    const client = await this.client();
    if (!client) return failure('not-available', 'Comptes indisponibles.');

    const parsed = displayNameSchema.safeParse(displayName);
    if (!parsed.success) {
      return failure('invalid', parsed.error.issues[0]?.message ?? 'Nom affiché invalide.');
    }

    const { data, error } = await client
      .from('profiles')
      .update({ display_name: parsed.data })
      .eq('id', userId)
      .select('*')
      .single();

    if (error || !data) return storageFailure('renommage du profil', error);
    return { ok: true, data: toProfile(data) };
  }

  async saveReview(input: SpotReviewInput, author: Author): Promise<ContributionResult<SpotReview>> {
    const client = await this.client();
    if (!client) return failure('not-available', 'Comptes indisponibles.');

    const parsed = spotReviewInputSchema.safeParse(input);
    if (!parsed.success) {
      return failure('invalid', parsed.error.issues[0]?.message ?? 'Avis invalide.');
    }

    // `upsert` sur (spot_slug, user_id) : un pêcheur a UN avis par spot, qu'il
    // peut réviser. Empiler les avis d'une même personne gonflerait la moyenne
    // et transformerait une note en tribune.
    const { data, error } = await client
      .from('spot_reviews')
      .upsert(
        {
          spot_slug: parsed.data.spotSlug,
          user_id: author.userId,
          author_name: author.displayName,
          rating: parsed.data.rating,
          comment: parsed.data.comment,
        },
        { onConflict: 'spot_slug,user_id' },
      )
      .select('*')
      .single();

    if (error || !data) return storageFailure('enregistrement d’un avis', error);
    return { ok: true, data: toReview(data) };
  }

  async deleteReview(reviewId: string): Promise<ContributionResult<null>> {
    const client = await this.client();
    if (!client) return failure('not-available', 'Comptes indisponibles.');

    // Aucun filtre sur l'utilisateur : c'est la politique RLS qui l'impose, et
    // elle ne peut pas être oubliée. Un filtre applicatif ici donnerait la
    // fausse impression que la sécurité vit dans ce fichier.
    const { error } = await client.from('spot_reviews').delete().eq('id', reviewId);
    if (error) return storageFailure('suppression d’un avis', error);

    return { ok: true, data: null };
  }

  async addCatch(input: CatchInput, author: Author): Promise<ContributionResult<Catch>> {
    const client = await this.client();
    if (!client) return failure('not-available', 'Comptes indisponibles.');

    const parsed = catchInputSchema.safeParse(input);
    if (!parsed.success) {
      return failure('invalid', parsed.error.issues[0]?.message ?? 'Déclaration invalide.');
    }

    const { data, error } = await client
      .from('catches')
      .insert({
        spot_slug: parsed.data.spotSlug,
        user_id: author.userId,
        author_name: author.displayName,
        species: parsed.data.species,
        length_cm: parsed.data.lengthCm,
        weight_g: parsed.data.weightG,
        released: parsed.data.released,
        caught_at: parsed.data.caughtAt,
        note: parsed.data.note,
        photo_path: parsed.data.photoPath ?? null,
      })
      .select('*')
      .single();

    if (error || !data) return storageFailure('déclaration d’une prise', error);
    return { ok: true, data: toCatch(data) };
  }

  async deleteCatch(catchId: string): Promise<ContributionResult<null>> {
    const client = await this.client();
    if (!client) return failure('not-available', 'Comptes indisponibles.');

    const { error } = await client.from('catches').delete().eq('id', catchId);
    if (error) return storageFailure('suppression d’une prise', error);

    return { ok: true, data: null };
  }

  async exportAccount(userId: string, email: string | null): Promise<ContributionResult<AccountExport>> {
    const client = await this.client();
    if (!client) return failure('not-available', 'Comptes indisponibles.');

    const [profile, reviews, catches] = await Promise.all([
      client.from('profiles').select('*').eq('id', userId).maybeSingle(),
      client.from('spot_reviews').select('*').eq('user_id', userId),
      client.from('catches').select('*').eq('user_id', userId),
    ]);

    if (reviews.error || catches.error) {
      return storageFailure('export du compte', reviews.error ?? catches.error);
    }

    return {
      ok: true,
      data: {
        exportedAt: new Date().toISOString(),
        account: { id: userId, email },
        profile: profile.data ? toProfile(profile.data) : null,
        reviews: (reviews.data ?? []).map(toReview),
        catches: (catches.data ?? []).map(toCatch),
      },
    };
  }

  async deleteAccount(userId: string): Promise<ContributionResult<null>> {
    const admin = supabaseAdmin();
    if (!admin) {
      // Refus net. Répondre « c'est fait » sans supprimer `auth.users`
      // laisserait un compte capable de se reconnecter, et une personne
      // convaincue d'avoir été effacée.
      return failure(
        'not-available',
        'La suppression de compte demande une configuration serveur absente (clé de service). Écrivez-nous : nous la ferons à la main.',
      );
    }

    // La cascade de `auth.users` emporte le profil, les avis et les prises :
    // c'est déclaré dans la migration, pas ici. Les photos, elles, vivent dans
    // le stockage et ne sont pas liées par une clé étrangère — elles sont
    // supprimées explicitement juste avant.
    const { data: photos } = await admin
      .from('catches')
      .select('photo_path')
      .eq('user_id', userId)
      .not('photo_path', 'is', null);

    const paths = (photos ?? [])
      .map((row) => row.photo_path)
      .filter((path): path is string => typeof path === 'string');

    if (paths.length > 0) {
      const { error } = await admin.storage.from('prises').remove(paths);
      if (error) console.error('[contributions] suppression des photos', error);
    }

    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) return storageFailure('suppression du compte', error);

    return { ok: true, data: null };
  }
}
