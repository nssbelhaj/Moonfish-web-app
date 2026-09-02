-- ═══════════════════════════════════════════════════════════════════════════
--  Moonfish — schéma MySQL / MariaDB
-- ═══════════════════════════════════════════════════════════════════════════
--
--  Exécution :  node scripts/migrer-mysql.mjs
--  ou, à la main :  mariadb -u UTILISATEUR -p BASE < db/migrations/0001_….sql
--
--  ─── LA DIFFÉRENCE MAJEURE AVEC LA VERSION POSTGRESQL ────────────────────
--
--  MySQL n'a PAS de sécurité au niveau des lignes. Sur PostgreSQL, la base
--  refusait elle-même une écriture au nom d'autrui : un filtre oublié dans le
--  code applicatif ne pouvait pas provoquer de fuite.
--
--  Cette garantie n'existe plus ici. Elle est remplacée par une discipline
--  VÉRIFIABLE, et il faut la connaître pour ne pas la casser :
--
--    1. tout le SQL du domaine vit dans `src/lib/providers/mysql/` ;
--    2. `src/lib/db/__tests__/proprietaire.test.ts` échoue si une requête
--       `update` ou `delete` visant une table détenue par un utilisateur
--       n'porte pas `user_id = ?` ;
--    3. un test interdit toute requête SQL ailleurs dans le dépôt.
--
--  Ce n'est pas équivalent à la sécurité au niveau des lignes — c'est plus
--  faible, parce que la garantie devient conventionnelle plutôt que
--  structurelle. C'est le prix assumé du passage à MySQL, et le dire est plus
--  utile que de faire comme si le modèle n'avait pas changé.

-- ── Tables d'authentification (schéma attendu par Auth.js) ────────────────
--
-- Les noms de colonnes sont imposés par la bibliothèque : `emailVerified` et
-- `sessionToken` ne suivent pas la convention du reste du fichier, et c'est
-- volontaire — les renommer demanderait de réécrire l'adaptateur pour rien.

create table if not exists users (
  id            varchar(36) primary key,
  name          varchar(255),
  email         varchar(255) unique,
  emailVerified datetime(3),
  image         varchar(1024),
  created_at    datetime(3) not null default current_timestamp(3)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

-- Comptes de fournisseurs externes (Google, GitHub…). Aucune n'est utilisée
-- aujourd'hui : la connexion se fait par lien envoyé par courriel. La table
-- existe parce que l'interface de l'adaptateur l'exige, et qu'ouvrir un
-- fournisseur plus tard ne demandera alors aucune migration.
create table if not exists accounts (
  id                  varchar(36) primary key,
  userId              varchar(36) not null,
  type                varchar(64) not null,
  provider            varchar(128) not null,
  providerAccountId   varchar(255) not null,
  refresh_token       text,
  access_token        text,
  expires_at          bigint,
  token_type          varchar(64),
  scope               varchar(512),
  id_token            text,
  session_state       varchar(255),
  unique key accounts_provider_account (provider, providerAccountId),
  key accounts_user (userId),
  constraint accounts_user_fk foreign key (userId) references users (id) on delete cascade
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table if not exists sessions (
  id           varchar(36) primary key,
  sessionToken varchar(255) not null unique,
  userId       varchar(36) not null,
  expires      datetime(3) not null,
  key sessions_user (userId),
  constraint sessions_user_fk foreign key (userId) references users (id) on delete cascade
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

-- Jetons des liens de connexion. `token` est stocké tel que la bibliothèque
-- le produit ; sa durée de vie est courte et il est consommé à la première
-- utilisation — c'est l'adaptateur qui le supprime en le lisant.
create table if not exists verification_tokens (
  identifier varchar(255) not null,
  token      varchar(255) not null,
  expires    datetime(3) not null,
  primary key (identifier, token),
  unique key verification_token_unique (token)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

-- ── Profil Moonfish ───────────────────────────────────────────────────────
--
-- Séparé de `users` plutôt que fondu dedans : `users` appartient à la
-- bibliothèque d'authentification et peut changer de forme à une mise à jour.
-- Ce qui est à NOUS vit ici, et la trace du consentement avec.

create table if not exists profiles (
  user_id         varchar(36) primary key,
  display_name    varchar(40) not null,
  consent_version varchar(32) not null,
  consent_at      datetime(3) not null default current_timestamp(3),
  created_at      datetime(3) not null default current_timestamp(3),
  constraint profiles_user_fk foreign key (user_id) references users (id) on delete cascade
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

-- ── Avis sur un spot ──────────────────────────────────────────────────────
--
-- `author_name` est une COPIE du nom affiché au moment de l'écriture. Deux
-- raisons : afficher une page publique ne demande alors aucune jointure vers
-- des données personnelles, et un avis garde le nom sous lequel il a été
-- publié. Le prix est qu'un changement de nom ne se propage pas aux anciens
-- avis, ce que l'écran de compte annonce.

create table if not exists spot_reviews (
  id          varchar(36) primary key,
  spot_slug   varchar(120) not null,
  user_id     varchar(36) not null,
  author_name varchar(40) not null,
  rating      tinyint unsigned not null,
  comment     varchar(1200),
  created_at  datetime(3) not null default current_timestamp(3),
  updated_at  datetime(3) not null default current_timestamp(3) on update current_timestamp(3),
  unique key spot_reviews_one_per_person (spot_slug, user_id),
  key spot_reviews_by_spot (spot_slug, created_at),
  constraint spot_reviews_rating_ck check (rating between 1 and 5),
  constraint spot_reviews_user_fk foreign key (user_id) references users (id) on delete cascade
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

-- ── Prises déclarées ──────────────────────────────────────────────────────
--
-- Aucune coordonnée : une prise est rattachée à un SPOT, jamais à une
-- position. Un point GPS de pêcheur est une information qu'on ne veut pas
-- détenir.

create table if not exists catches (
  id          varchar(36) primary key,
  spot_slug   varchar(120) not null,
  user_id     varchar(36) not null,
  author_name varchar(40) not null,
  species     varchar(60) not null,
  length_cm   smallint unsigned,
  weight_g    int unsigned,
  released    tinyint(1) not null default 0,
  caught_at   datetime(3) not null,
  note        varchar(600),
  photo_path  varchar(300),
  created_at  datetime(3) not null default current_timestamp(3),
  key catches_by_spot (spot_slug, caught_at),
  key catches_by_user (user_id),
  constraint catches_length_ck check (length_cm is null or length_cm between 1 and 400),
  constraint catches_weight_ck check (weight_g is null or weight_g between 1 and 200000),
  constraint catches_user_fk foreign key (user_id) references users (id) on delete cascade
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

-- ── Liste d'attente ───────────────────────────────────────────────────────
--
-- Sur PostgreSQL, cette table n'était lisible par PERSONNE : aucune politique
-- de lecture n'existait, ce qui rendait les adresses inaspirables même avec la
-- clé publique. Ici, la protection ne vient plus de la base mais du fait
-- qu'aucun chemin de lecture n'existe dans le code — et le test
-- `proprietaire.test.ts` échoue si un `select` apparaît sur cette table.

create table if not exists waitlist (
  email      varchar(254) primary key,
  source     varchar(64) not null default 'site',
  created_at datetime(3) not null default current_timestamp(3)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;
