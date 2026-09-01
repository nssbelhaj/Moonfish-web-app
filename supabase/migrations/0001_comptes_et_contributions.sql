-- ═══════════════════════════════════════════════════════════════════════════
--  Moonfish — comptes, contributions et liste d'attente
-- ═══════════════════════════════════════════════════════════════════════════
--
--  À exécuter dans l'éditeur SQL du projet Supabase, une seule fois.
--
--  Principe de bout en bout : la sécurité est DANS LA BASE, pas dans le code
--  applicatif. Chaque table active la sécurité au niveau des lignes (RLS) et
--  n'expose que ce qu'il faut. Une faille dans une page ne peut donc pas
--  laisser lire ou écrire ce que la politique interdit — et une requête
--  oubliée sans filtre ne rend rien plutôt que tout.
--
--  Conséquence assumée : la suppression d'un compte EFFACE ses contributions
--  (« on delete cascade »). C'est le droit à l'effacement pris au sérieux ;
--  garder des avis orphelins sous un pseudonyme resterait une donnée liée à
--  une personne.

-- ── Liste d'attente ────────────────────────────────────────────────────────
--
-- Personne ne peut la LIRE, pas même un utilisateur connecté : seule la clé de
-- service, qui ne quitte jamais le serveur, en a le droit. L'insertion, elle,
-- est ouverte — c'est un formulaire public.

create table if not exists public.waitlist (
  email      text primary key,
  source     text not null default 'site',
  created_at timestamptz not null default now()
);

alter table public.waitlist enable row level security;

drop policy if exists "waitlist_insert_public" on public.waitlist;
create policy "waitlist_insert_public"
  on public.waitlist for insert
  to anon, authenticated
  with check (true);

-- Aucune politique de SELECT : la table est en écriture seule pour le public.

-- ── Profils ───────────────────────────────────────────────────────────────
--
-- Le strict nécessaire : un nom affiché et la trace du consentement. Ni date de
-- naissance, ni adresse, ni téléphone — ce que nous ne collectons pas ne peut
-- ni fuir ni être réclamé.

create table if not exists public.profiles (
  id               uuid primary key references auth.users (id) on delete cascade,
  display_name     text not null check (char_length(display_name) between 2 and 40),
  consent_version  text not null,
  consent_at       timestamptz not null default now(),
  created_at       timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "profiles_delete_own" on public.profiles;
create policy "profiles_delete_own"
  on public.profiles for delete
  to authenticated
  using (auth.uid() = id);

-- ── Avis sur un spot ──────────────────────────────────────────────────────
--
-- `author_name` est une COPIE du nom affiché au moment de l'écriture, et non
-- une jointure vers `profiles`. Deux raisons : la table des profils reste
-- illisible pour les autres (personne ne peut en tirer la liste des comptes),
-- et l'affichage d'une page publique ne demande aucune lecture de données
-- personnelles. Le prix à payer est qu'un changement de nom ne se propage pas
-- aux anciens avis, ce que l'écran de compte annonce.

create table if not exists public.spot_reviews (
  id          uuid primary key default gen_random_uuid(),
  spot_slug   text not null,
  user_id     uuid not null references auth.users (id) on delete cascade,
  author_name text not null,
  rating      smallint not null check (rating between 1 and 5),
  comment     text check (char_length(comment) <= 1200),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (spot_slug, user_id)
);

create index if not exists spot_reviews_by_spot on public.spot_reviews (spot_slug, created_at desc);

alter table public.spot_reviews enable row level security;

drop policy if exists "reviews_select_public" on public.spot_reviews;
create policy "reviews_select_public"
  on public.spot_reviews for select
  to anon, authenticated
  using (true);

drop policy if exists "reviews_write_own" on public.spot_reviews;
create policy "reviews_write_own"
  on public.spot_reviews for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "reviews_update_own" on public.spot_reviews;
create policy "reviews_update_own"
  on public.spot_reviews for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "reviews_delete_own" on public.spot_reviews;
create policy "reviews_delete_own"
  on public.spot_reviews for delete
  to authenticated
  using (auth.uid() = user_id);

-- ── Prises déclarées ──────────────────────────────────────────────────────
--
-- `caught_at` est saisi par le pêcheur et peut être antérieur à la
-- déclaration ; il est borné pour empêcher les dates absurdes, dans le futur
-- ou avant l'existence du site.
--
-- Aucune coordonnée : la prise est rattachée à un SPOT, jamais à une position.
-- Un point GPS de pêcheur est une information qu'on ne veut pas détenir.

create table if not exists public.catches (
  id          uuid primary key default gen_random_uuid(),
  spot_slug   text not null,
  user_id     uuid not null references auth.users (id) on delete cascade,
  author_name text not null,
  species     text not null check (char_length(species) between 2 and 60),
  length_cm   smallint check (length_cm between 1 and 400),
  weight_g    integer check (weight_g between 1 and 200000),
  released    boolean not null default false,
  caught_at   timestamptz not null check (caught_at > timestamptz '2024-01-01'),
  note        text check (char_length(note) <= 600),
  photo_path  text,
  created_at  timestamptz not null default now()
);

create index if not exists catches_by_spot on public.catches (spot_slug, caught_at desc);

alter table public.catches enable row level security;

drop policy if exists "catches_select_public" on public.catches;
create policy "catches_select_public"
  on public.catches for select
  to anon, authenticated
  using (true);

drop policy if exists "catches_insert_own" on public.catches;
create policy "catches_insert_own"
  on public.catches for insert
  to authenticated
  with check (auth.uid() = user_id and caught_at <= now());

drop policy if exists "catches_update_own" on public.catches;
create policy "catches_update_own"
  on public.catches for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "catches_delete_own" on public.catches;
create policy "catches_delete_own"
  on public.catches for delete
  to authenticated
  using (auth.uid() = user_id);

-- ── Photos de prises ──────────────────────────────────────────────────────
--
-- Le seau est PUBLIC en lecture — les photos illustrent des pages publiques —
-- mais l'écriture est cloisonnée par utilisateur : le premier segment du
-- chemin doit être son identifiant. Personne ne peut donc écraser ni supprimer
-- la photo d'un autre.
--
-- Les métadonnées EXIF sont retirées AVANT l'envoi, dans le navigateur : une
-- photo de téléphone porte les coordonnées GPS de la prise, donc parfois celles
-- d'un spot qu'on voulait garder, ou d'un domicile. Le retrait côté serveur
-- serait trop tard — le fichier d'origine aurait déjà voyagé.

insert into storage.buckets (id, name, public)
values ('prises', 'prises', true)
on conflict (id) do nothing;

drop policy if exists "prises_read_public" on storage.objects;
create policy "prises_read_public"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'prises');

drop policy if exists "prises_write_own_folder" on storage.objects;
create policy "prises_write_own_folder"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'prises' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "prises_delete_own_folder" on storage.objects;
create policy "prises_delete_own_folder"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'prises' and (storage.foldername(name))[1] = auth.uid()::text);

-- ── Horodatage de mise à jour ─────────────────────────────────────────────

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists spot_reviews_touch on public.spot_reviews;
create trigger spot_reviews_touch
  before update on public.spot_reviews
  for each row execute function public.touch_updated_at();
