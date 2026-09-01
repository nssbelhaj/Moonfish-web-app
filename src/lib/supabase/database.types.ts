/**
 * Type des tables, écrit à la main plutôt que généré.
 *
 * `supabase gen types` demande un accès au projet ; ce fichier doit rester
 * lisible sans. Il n'est pas la vérité — la vérité est
 * `supabase/migrations/0001_comptes_et_contributions.sql` — mais il en est le
 * miroir, et `src/lib/supabase/__tests__/schema.test.ts` vérifie que les deux
 * ne divergent pas : une colonne ajoutée au SQL sans l'être ici fait échouer
 * les tests.
 *
 * Tout est déclaré en `type` et non en `interface`, et les formes d'insertion
 * sont écrites en toutes lettres au lieu d'être dérivées par
 * `Pick & Partial<Omit<…>>`. Ce n'est pas un choix de style : le client
 * Supabase contraint chaque table à `Record<string, unknown>`, ce qu'une
 * INTERSECTION de types utilitaires ne satisfait pas — le schéma entier se
 * résolvait alors en `never` et toutes les requêtes perdaient leur typage, en
 * silence, sans qu'aucune erreur ne désigne la cause.
 */

export type WaitlistRow = {
  email: string;
  source: string;
  created_at: string;
};

export type WaitlistInsert = {
  email: string;
  source?: string;
  created_at?: string;
};

export type ProfileRow = {
  id: string;
  display_name: string;
  consent_version: string;
  consent_at: string;
  created_at: string;
};

export type ProfileInsert = {
  id: string;
  display_name: string;
  consent_version: string;
  consent_at?: string;
  created_at?: string;
};

export type ProfileUpdate = {
  display_name?: string;
  consent_version?: string;
  consent_at?: string;
};

export type SpotReviewRow = {
  id: string;
  spot_slug: string;
  user_id: string;
  author_name: string;
  rating: number;
  comment: string | null;
  created_at: string;
  updated_at: string;
};

export type SpotReviewInsert = {
  id?: string;
  spot_slug: string;
  user_id: string;
  author_name: string;
  rating: number;
  comment?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type SpotReviewUpdate = {
  author_name?: string;
  rating?: number;
  comment?: string | null;
};

export type CatchRow = {
  id: string;
  spot_slug: string;
  user_id: string;
  author_name: string;
  species: string;
  length_cm: number | null;
  weight_g: number | null;
  released: boolean;
  caught_at: string;
  note: string | null;
  photo_path: string | null;
  created_at: string;
};

export type CatchInsert = {
  id?: string;
  spot_slug: string;
  user_id: string;
  author_name: string;
  species: string;
  length_cm?: number | null;
  weight_g?: number | null;
  released?: boolean;
  caught_at: string;
  note?: string | null;
  photo_path?: string | null;
  created_at?: string;
};

export type CatchUpdate = {
  species?: string;
  length_cm?: number | null;
  weight_g?: number | null;
  released?: boolean;
  caught_at?: string;
  note?: string | null;
  photo_path?: string | null;
};

export type Database = {
  public: {
    Tables: {
      waitlist: {
        Row: WaitlistRow;
        Insert: WaitlistInsert;
        Update: WaitlistInsert;
        Relationships: [];
      };
      profiles: {
        Row: ProfileRow;
        Insert: ProfileInsert;
        Update: ProfileUpdate;
        Relationships: [];
      };
      spot_reviews: {
        Row: SpotReviewRow;
        Insert: SpotReviewInsert;
        Update: SpotReviewUpdate;
        Relationships: [];
      };
      catches: {
        Row: CatchRow;
        Insert: CatchInsert;
        Update: CatchUpdate;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

/**
 * Colonnes de chaque table, à l'exécution.
 *
 * Un type TypeScript disparaît à la compilation : il ne peut donc pas être
 * comparé au fichier SQL. Ces constantes le rendent vérifiable, et le
 * `satisfies` garantit qu'elles ne peuvent pas s'écarter du type — il faut
 * DEUX oublis simultanés pour que le miroir se brise, et le test attrape le
 * second.
 */
export const TABLE_COLUMNS = {
  waitlist: { email: true, source: true, created_at: true } satisfies Record<keyof WaitlistRow, true>,
  profiles: {
    id: true,
    display_name: true,
    consent_version: true,
    consent_at: true,
    created_at: true,
  } satisfies Record<keyof ProfileRow, true>,
  spot_reviews: {
    id: true,
    spot_slug: true,
    user_id: true,
    author_name: true,
    rating: true,
    comment: true,
    created_at: true,
    updated_at: true,
  } satisfies Record<keyof SpotReviewRow, true>,
  catches: {
    id: true,
    spot_slug: true,
    user_id: true,
    author_name: true,
    species: true,
    length_cm: true,
    weight_g: true,
    released: true,
    caught_at: true,
    note: true,
    photo_path: true,
    created_at: true,
  } satisfies Record<keyof CatchRow, true>,
} as const;

/** Seau de stockage des photos de prises. */
export const PHOTO_BUCKET = 'prises';
