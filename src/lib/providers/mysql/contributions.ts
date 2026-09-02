import { randomUUID } from 'node:crypto';

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
import { CONSENT_VERSION } from '@/lib/auth/consent';
import { execute, query, queryOne, toIso, toMysqlDateTime } from '@/lib/db/mysql';
import { deletePhoto } from '@/lib/photo/storage';
import type {
  AccountExport,
  Author,
  ContributionResult,
  ContributionsRepository,
  SpotContributions,
} from '../types';

/**
 * Contributions stockées dans MySQL.
 *
 * ═══ CE FICHIER PORTE UNE GARANTIE QUE LA BASE N'APPLIQUE PLUS ═══
 *
 * Sur PostgreSQL, la sécurité au niveau des lignes refusait toute écriture au
 * nom d'autrui : le filtre était dans le moteur, pas dans le code. MySQL n'a
 * pas d'équivalent, et cette responsabilité est retombée ici.
 *
 * Trois règles, qu'un test fait respecter
 * (`src/lib/db/__tests__/proprietaire.test.ts`) :
 *
 *   1. toute requête `update` ou `delete` sur une table détenue par un
 *      utilisateur porte `user_id = ?`. Sans exception, y compris quand
 *      l'identifiant de la ligne suffirait « logiquement » ;
 *   2. la suppression prend l'identifiant du propriétaire en paramètre
 *      OBLIGATOIRE — la signature interdit de l'oublier, le compilateur
 *      refuse l'appel ;
 *   3. aucune lecture n'existe sur `waitlist`. Sur PostgreSQL, aucune
 *      politique ne l'autorisait ; ici, la protection est qu'aucun chemin de
 *      lecture n'est écrit, et le test échoue si l'un apparaît.
 *
 * Le nombre de lignes affectées est vérifié après chaque écriture ciblée :
 * zéro ligne veut dire « pas votre ligne », et le refus est explicite plutôt
 * que silencieux.
 */

/** Nombre d'éléments rendus par spot. Au-delà, la page devient un mur. */
const PAGE_SIZE = 50;

interface ReviewRow {
  id: string;
  spot_slug: string;
  user_id: string;
  author_name: string;
  rating: number;
  comment: string | null;
  created_at: string;
  updated_at: string;
}

interface CatchRow {
  id: string;
  spot_slug: string;
  user_id: string;
  author_name: string;
  species: string;
  length_cm: number | null;
  weight_g: number | null;
  released: number;
  caught_at: string;
  note: string | null;
  photo_path: string | null;
  created_at: string;
}

interface ProfileRow {
  user_id: string;
  display_name: string;
  consent_version: string;
  consent_at: string;
  created_at: string;
}

function failure<T>(
  reason: 'not-available' | 'not-authenticated' | 'invalid' | 'storage-error',
  message: string,
): ContributionResult<T> {
  return { ok: false, reason, message };
}

/**
 * Message montrable.
 *
 * L'erreur brute d'un pilote SQL cite la requête, la table et parfois la
 * valeur rejetée. La rendre telle quelle serait à la fois illisible et bavarde
 * sur la structure interne. On journalise le détail, on affiche une phrase.
 */
function storageFailure<T>(context: string, error: unknown): ContributionResult<T> {
  console.error(`[contributions] ${context}`, error);
  return failure('storage-error', 'Enregistrement impossible pour le moment. Réessayez plus tard.');
}

function toReview(row: ReviewRow): SpotReview {
  return spotReviewSchema.parse({
    id: row.id,
    spotSlug: row.spot_slug,
    userId: row.user_id,
    authorName: row.author_name,
    rating: row.rating,
    comment: row.comment,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
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
    // MySQL rend un booléen comme 0 ou 1 : sans cette conversion, `released`
    // vaudrait 0, qui est falsy mais n'est PAS `false` pour Zod.
    released: row.released === 1,
    caughtAt: toIso(row.caught_at),
    note: row.note,
    photoPath: row.photo_path,
    createdAt: toIso(row.created_at),
  });
}

function toProfile(row: ProfileRow): Profile {
  return profileSchema.parse({
    id: row.user_id,
    displayName: row.display_name,
    consentVersion: row.consent_version,
    consentAt: toIso(row.consent_at),
    createdAt: toIso(row.created_at),
  });
}

export class MysqlContributionsRepository implements ContributionsRepository {
  readonly available = true;

  readonly source = {
    name: 'Contributions des pêcheurs (MySQL)',
    kind: 'measured' as const,
    precision:
      'Avis et prises déclarés par des personnes titulaires d’un compte. Ce sont des témoignages, pas des mesures : nous ne les vérifions pas.',
  };

  async forSpot(spotSlug: string): Promise<SpotContributions> {
    try {
      const [reviews, catches] = await Promise.all([
        query<ReviewRow>(
          'select * from spot_reviews where spot_slug = ? order by created_at desc limit ?',
          [spotSlug, PAGE_SIZE],
        ),
        query<CatchRow>(
          'select * from catches where spot_slug = ? order by caught_at desc limit ?',
          [spotSlug, PAGE_SIZE],
        ),
      ]);

      const parsedReviews = reviews.map(toReview);

      return {
        reviews: parsedReviews,
        catches: catches.map(toCatch),
        averageRating:
          parsedReviews.length === 0
            ? null
            : parsedReviews.reduce((total, review) => total + review.rating, 0) /
              parsedReviews.length,
        reviewCount: parsedReviews.length,
      };
    } catch (error) {
      // Une panne de lecture rend une page VIDE, jamais une erreur 500 : le
      // reste de la page du spot — marée, vent, score — n'a aucune raison de
      // tomber parce que les avis sont indisponibles.
      console.error('[contributions] lecture du spot', error);
      return { reviews: [], catches: [], averageRating: null, reviewCount: 0 };
    }
  }

  async listForUser(userId: string): Promise<{ reviews: SpotReview[]; catches: Catch[] }> {
    try {
      const [reviews, catches] = await Promise.all([
        query<ReviewRow>('select * from spot_reviews where user_id = ? order by created_at desc', [
          userId,
        ]),
        query<CatchRow>('select * from catches where user_id = ? order by caught_at desc', [userId]),
      ]);

      return { reviews: reviews.map(toReview), catches: catches.map(toCatch) };
    } catch (error) {
      console.error('[contributions] lecture des contributions', error);
      return { reviews: [], catches: [] };
    }
  }

  async getProfile(userId: string): Promise<Profile | null> {
    try {
      const row = await queryOne<ProfileRow>('select * from profiles where user_id = ?', [userId]);
      return row ? toProfile(row) : null;
    } catch (error) {
      console.error('[contributions] lecture du profil', error);
      return null;
    }
  }

  async createProfile(userId: string, displayName: string): Promise<ContributionResult<Profile>> {
    const parsed = displayNameSchema.safeParse(displayName);
    if (!parsed.success) {
      return failure('invalid', parsed.error.issues[0]?.message ?? 'Nom affiché invalide.');
    }

    try {
      await execute(
        'insert into profiles (user_id, display_name, consent_version) values (?, ?, ?)',
        [userId, parsed.data, CONSENT_VERSION],
      );

      const profile = await this.getProfile(userId);
      return profile
        ? { ok: true, data: profile }
        : storageFailure('création du profil', 'profil introuvable après insertion');
    } catch (error) {
      return storageFailure('création du profil', error);
    }
  }

  async renameProfile(userId: string, displayName: string): Promise<ContributionResult<Profile>> {
    const parsed = displayNameSchema.safeParse(displayName);
    if (!parsed.success) {
      return failure('invalid', parsed.error.issues[0]?.message ?? 'Nom affiché invalide.');
    }

    try {
      const touched = await execute('update profiles set display_name = ? where user_id = ?', [
        parsed.data,
        userId,
      ]);

      if (touched === 0) return failure('invalid', 'Profil introuvable.');

      const profile = await this.getProfile(userId);
      return profile
        ? { ok: true, data: profile }
        : storageFailure('renommage du profil', 'profil introuvable après mise à jour');
    } catch (error) {
      return storageFailure('renommage du profil', error);
    }
  }

  async saveReview(input: SpotReviewInput, author: Author): Promise<ContributionResult<SpotReview>> {
    const parsed = spotReviewInputSchema.safeParse(input);
    if (!parsed.success) {
      return failure('invalid', parsed.error.issues[0]?.message ?? 'Avis invalide.');
    }

    try {
      /*
        Un pêcheur a UN avis par spot, qu'il peut réviser. Empiler les avis
        d'une même personne gonflerait la moyenne et transformerait une note en
        tribune. `on duplicate key update` s'appuie sur la clé unique
        (spot_slug, user_id) — c'est la base qui garantit l'unicité, pas une
        lecture préalable qui laisserait une fenêtre de concurrence.
      */
      await execute(
        `insert into spot_reviews (id, spot_slug, user_id, author_name, rating, comment)
         values (?, ?, ?, ?, ?, ?)
         on duplicate key update
           author_name = values(author_name),
           rating = values(rating),
           comment = values(comment)`,
        [
          randomUUID(),
          parsed.data.spotSlug,
          author.userId,
          author.displayName,
          parsed.data.rating,
          parsed.data.comment,
        ],
      );

      const row = await queryOne<ReviewRow>(
        'select * from spot_reviews where spot_slug = ? and user_id = ?',
        [parsed.data.spotSlug, author.userId],
      );

      return row
        ? { ok: true, data: toReview(row) }
        : storageFailure('enregistrement d’un avis', 'avis introuvable après écriture');
    } catch (error) {
      return storageFailure('enregistrement d’un avis', error);
    }
  }

  /**
   * Suppression d'un avis.
   *
   * `userId` est OBLIGATOIRE dans la signature : c'est ce qui remplace la
   * politique de sécurité que PostgreSQL appliquait. Le compilateur refuse
   * l'appel sans propriétaire, et la requête porte le filtre.
   */
  async deleteReview(reviewId: string, userId: string): Promise<ContributionResult<null>> {
    try {
      const touched = await execute('delete from spot_reviews where id = ? and user_id = ?', [
        reviewId,
        userId,
      ]);

      // Zéro ligne : l'avis n'existe pas, ou il n'est pas le vôtre. On ne
      // distingue pas les deux — le dire renseignerait sur l'existence d'une
      // ligne qui ne vous regarde pas.
      if (touched === 0) return failure('invalid', 'Cet avis est introuvable.');

      return { ok: true, data: null };
    } catch (error) {
      return storageFailure('suppression d’un avis', error);
    }
  }

  async addCatch(input: CatchInput, author: Author): Promise<ContributionResult<Catch>> {
    const parsed = catchInputSchema.safeParse(input);
    if (!parsed.success) {
      return failure('invalid', parsed.error.issues[0]?.message ?? 'Déclaration invalide.');
    }

    const id = randomUUID();

    try {
      await execute(
        `insert into catches
           (id, spot_slug, user_id, author_name, species, length_cm, weight_g, released, caught_at, note, photo_path)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          parsed.data.spotSlug,
          author.userId,
          author.displayName,
          parsed.data.species,
          parsed.data.lengthCm,
          parsed.data.weightG,
          parsed.data.released ? 1 : 0,
          toMysqlDateTime(parsed.data.caughtAt),
          parsed.data.note,
          parsed.data.photoPath ?? null,
        ],
      );

      const row = await queryOne<CatchRow>('select * from catches where id = ?', [id]);
      return row
        ? { ok: true, data: toCatch(row) }
        : storageFailure('déclaration d’une prise', 'prise introuvable après écriture');
    } catch (error) {
      return storageFailure('déclaration d’une prise', error);
    }
  }

  async deleteCatch(catchId: string, userId: string): Promise<ContributionResult<null>> {
    try {
      // La photo est lue AVANT la suppression de la ligne : après, son chemin
      // est perdu et le fichier resterait sur le disque pour toujours.
      const row = await queryOne<{ photo_path: string | null }>(
        'select photo_path from catches where id = ? and user_id = ?',
        [catchId, userId],
      );

      const touched = await execute('delete from catches where id = ? and user_id = ?', [
        catchId,
        userId,
      ]);

      if (touched === 0) return failure('invalid', 'Cette prise est introuvable.');

      if (row?.photo_path) await deletePhoto(row.photo_path);

      return { ok: true, data: null };
    } catch (error) {
      return storageFailure('suppression d’une prise', error);
    }
  }

  async exportAccount(
    userId: string,
    email: string | null,
  ): Promise<ContributionResult<AccountExport>> {
    try {
      const [profile, mine] = await Promise.all([
        this.getProfile(userId),
        this.listForUser(userId),
      ]);

      return {
        ok: true,
        data: {
          exportedAt: new Date().toISOString(),
          account: { id: userId, email },
          profile,
          reviews: mine.reviews,
          catches: mine.catches,
        },
      };
    } catch (error) {
      return storageFailure('export du compte', error);
    }
  }

  /**
   * Effacement du compte.
   *
   * Les contributions partent par cascade — c'est déclaré dans le schéma, pas
   * ici, donc on ne peut pas l'oublier. Les photos, elles, vivent sur le
   * disque et ne sont liées par aucune clé étrangère : elles sont supprimées
   * explicitement AVANT, tant que leurs chemins sont encore lisibles.
   */
  async deleteAccount(userId: string): Promise<ContributionResult<null>> {
    try {
      const photos = await query<{ photo_path: string | null }>(
        'select photo_path from catches where user_id = ? and photo_path is not null',
        [userId],
      );

      for (const row of photos) {
        if (row.photo_path) await deletePhoto(row.photo_path);
      }

      const touched = await execute('delete from users where id = ?', [userId]);
      if (touched === 0) return failure('invalid', 'Compte introuvable.');

      return { ok: true, data: null };
    } catch (error) {
      return storageFailure('suppression du compte', error);
    }
  }
}
