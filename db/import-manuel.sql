-- ═══════════════════════════════════════════════════════════════════════════
--  Luna Marea — schéma complet, prêt à importer
-- ═══════════════════════════════════════════════════════════════════════════
--
--  FICHIER GÉNÉRÉ. Ne le modifiez pas : « node scripts/generer-import-sql.mjs ».
--
--  ─── À quoi il sert, et quand il ne sert à rien ──────────────────────────
--
--  Il n'est utile que si vous n'avez PAS de terminal sur l'hébergement et
--  devez passer par phpMyAdmin. Sur un déploiement normal, il n'y a rien à
--  importer : `prestart` applique les migrations tout seul avant chaque
--  démarrage, et c'est le chemin à préférer.
--
--  ─── Import ──────────────────────────────────────────────────────────────
--
--  phpMyAdmin → votre base → Importer → ce fichier → Exécuter.
--  Choisissez bien la base AVANT : le fichier n'en crée ni n'en sélectionne
--  aucune, exprès. Un « create database » ici écraserait un choix déjà fait
--  dans l'interface, et sur un hébergement mutualisé le nom de la base est
--  imposé par le panneau, pas par nous.
--
--  Il est SANS DANGER sur une base déjà en service : tout est en
--  « create table if not exists », et l'inscription dans `schema_migrations`
--  est en « insert ignore ». Le rejouer ne détruit rien et ne perd rien.
--
--  ─── Ce que la dernière section fait, et pourquoi elle est indispensable ──
--
--  Elle inscrit chaque migration comme DÉJÀ APPLIQUÉE, avec son empreinte.
--  Sans elle, le premier démarrage de l'application les rejouerait toutes :
--  aujourd'hui sans dégât, mais la première migration qui ajoutera une colonne
--  échouerait alors en pleine mise en ligne.
--
--  ─── Après l'import ──────────────────────────────────────────────────────
--
--  Rien. Renseignez DATABASE_URL et démarrez : le site trouve son schéma en
--  place et le confirme au démarrage par « schéma déjà à jour ».

create table if not exists schema_migrations (
  filename   varchar(255) primary key,
  checksum   char(64) not null,
  applied_at datetime(3) not null default current_timestamp(3)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

-- ┌────────────────────────────────────────────────────────────────────────
-- │ 0001_comptes_et_contributions.sql
-- └────────────────────────────────────────────────────────────────────────

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

-- ┌────────────────────────────────────────────────────────────────────────
-- │ 0002_favoris_et_sorties.sql
-- └────────────────────────────────────────────────────────────────────────

-- ═══════════════════════════════════════════════════════════════════════════
--  Moonfish — favoris et sorties programmées
-- ═══════════════════════════════════════════════════════════════════════════
--
--  Deux tables, toutes deux DÉTENUES par un utilisateur : chaque ligne porte
--  `user_id`, et chaque `update` ou `delete` du code doit filtrer dessus.
--  `src/lib/db/__tests__/proprietaire.test.ts` les a ajoutées à sa liste.
--
--  Elles partent par cascade avec le compte. C'est déclaré ici, pas dans le
--  code : on ne peut pas l'oublier.

-- ── Favoris ───────────────────────────────────────────────────────────────
--
-- Une paire (personne, spot), rien d'autre. Pas d'identifiant propre : la
-- clé primaire composée EST l'unicité, et « ajouter deux fois » devient une
-- non-opération plutôt qu'un doublon à dédoublonner.

create table if not exists favorites (
  user_id    varchar(36) not null,
  spot_slug  varchar(120) not null,
  created_at datetime(3) not null default current_timestamp(3),
  primary key (user_id, spot_slug),
  constraint favorites_user_fk foreign key (user_id) references users (id) on delete cascade
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

-- ── Sorties programmées ───────────────────────────────────────────────────
--
-- `planned_at` est en UTC, comme toutes les dates du projet. Le fuseau du
-- spot sert à l'AFFICHER, jamais à la stocker.
--
-- `alert` : la personne veut-elle un courriel la veille, avec les conditions
-- prévues ? C'est un choix par sortie, pas un réglage global — on peut vouloir
-- être prévenu pour une session de surfcasting exposée et pas pour une heure
-- de rockfishing à l'abri.
--
-- `notified_at` : quand le courriel est parti. Il est la garde d'idempotence
-- de la tâche d'entretien : elle peut tourner dix fois, le courriel part une
-- fois. Sans cette colonne, un cron relancé après incident renverrait tout.
--
-- `min_score` : seuil facultatif, de 1 à 10. En dessous, l'alerte le dit
-- clairement. Absent, l'alerte se contente de rapporter les conditions — et
-- le danger, qui, lui, est TOUJOURS signalé, seuil ou pas.

create table if not exists outings (
  id          varchar(36) primary key,
  user_id     varchar(36) not null,
  spot_slug   varchar(120) not null,
  planned_at  datetime(3) not null,
  note        varchar(300),
  alert       tinyint(1) not null default 1,
  min_score   tinyint unsigned,
  notified_at datetime(3),
  created_at  datetime(3) not null default current_timestamp(3),
  key outings_by_user (user_id, planned_at),
  key outings_pending (alert, notified_at, planned_at),
  constraint outings_min_score_ck check (min_score is null or min_score between 1 and 10),
  constraint outings_user_fk foreign key (user_id) references users (id) on delete cascade
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

-- ┌────────────────────────────────────────────────────────────────────────
-- │ 0003_limites_de_debit.sql
-- └────────────────────────────────────────────────────────────────────────

-- ═══════════════════════════════════════════════════════════════════════════
--  Limites de débit durables
-- ═══════════════════════════════════════════════════════════════════════════
--
--  Jusqu'ici le limiteur vivait dans la mémoire du processus, et il ne
--  couvrait qu'un seul point d'entrée : la liste d'attente. Le formulaire de
--  connexion, lui, n'avait AUCUNE limite — alors qu'il fait partir un
--  courriel à une adresse fournie par l'appelant, sans authentification.
--
--  Deux conséquences, la seconde pire que la première :
--    1. n'importe qui pouvait faire envoyer du courrier à n'importe qui,
--       depuis notre domaine ;
--    2. un hébergeur mutualisé plafonne les envois SMTP à l'heure. Dépasser
--       le plafond suspend le compte d'envoi — et plus PERSONNE ne peut se
--       connecter, puisqu'il n'y a pas de mot de passe de secours.
--
--  Cette table rend la limite durable (elle survit aux redémarrages et aux
--  redéploiements) et partagée (elle vaut même si plusieurs instances
--  tournent). Une ligne = une tentative.
--
--  Elle n'appartient à personne : `subject` est une EMPREINTE, jamais une
--  adresse ni une IP. On ne peut donc pas remonter de cette table à une
--  personne, et elle n'a pas sa place dans l'export de compte.

create table if not exists rate_limits (
  id       bigint unsigned not null auto_increment,

  -- Quel budget : 'connexion-adresse', 'connexion-ip', 'connexion-global'…
  bucket   varchar(48) not null,

  -- SHA-256 tronqué de la clé. Non réversible, et suffisant pour compter.
  subject  char(32) not null,

  hit_at   datetime(3) not null,

  primary key (id),

  -- L'ordre des colonnes suit la requête : on filtre sur (bucket, subject)
  -- puis on borne sur hit_at. Un index dans cet ordre répond sans lire la
  -- table.
  key idx_fenetre (bucket, subject, hit_at),

  -- Le ménage balaie sur hit_at seul, tous budgets confondus.
  key idx_menage (hit_at)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

-- ┌────────────────────────────────────────────────────────────────────────
-- │ 0004_mot_de_passe_et_identite.sql
-- └────────────────────────────────────────────────────────────────────────

-- ═══════════════════════════════════════════════════════════════════════════
--  Comptes classiques : mot de passe et identité
-- ═══════════════════════════════════════════════════════════════════════════
--
--  Jusqu'ici la connexion se faisait par lien envoyé par courriel, sans mot
--  de passe. Le raisonnement tenait : ce qu'on ne stocke pas ne peut pas
--  fuir. Il supposait un serveur d'envoi qui marche — et tant qu'il ne
--  marche pas, PERSONNE ne peut créer de compte.
--
--  Ce que ce changement coûte, et qu'il faut assumer :
--    · nous détenons désormais un secret que la personne réutilise
--      peut-être ailleurs. D'où scrypt, et jamais le mot de passe en clair
--      nulle part — ni en base, ni dans un journal, ni dans un export ;
--    · sans courriel, un mot de passe oublié est un compte PERDU. Le lien
--      par courriel reste donc en place comme second chemin, et redevient
--      disponible dès que l'envoi fonctionne.
--
--  Le lien par courriel n'est pas supprimé : les deux chemins mènent au même
--  compte, reconnu par son adresse.

-- ── Empreinte du mot de passe ─────────────────────────────────────────────
--
-- Table SÉPARÉE de `users`, et ce n'est pas cosmétique. `users` appartient à
-- l'adaptateur d'Auth.js, qui la lit et l'écrit selon son propre contrat ;
-- y ajouter une colonne nous exposerait à toute évolution de la
-- bibliothèque. Un compte sans ligne ici est un compte sans mot de passe —
-- créé par lien, ou par un fournisseur externe plus tard.

create table if not exists user_credentials (
  user_id       varchar(36) primary key,

  -- Format : scrypt$N$r$p$sel$empreinte, tout en base64url. L'algorithme et
  -- ses paramètres sont STOCKÉS AVEC l'empreinte : le jour où on les durcit,
  -- les anciennes empreintes restent vérifiables et se remplacent à la
  -- prochaine connexion réussie.
  password_hash varchar(255) not null,

  -- Compte les échecs consécutifs. Le limiteur d'appels protège déjà par IP
  -- et par adresse ; ceci protège le COMPTE lui-même, quel que soit l'endroit
  -- d'où viennent les tentatives.
  failed_count  int unsigned not null default 0,
  locked_until  datetime(3) null,

  updated_at    datetime(3) not null default current_timestamp(3) on update current_timestamp(3),

  constraint user_credentials_user_fk foreign key (user_id) references users (id) on delete cascade
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

-- ── Identité, sur le profil ───────────────────────────────────────────────
--
-- Les trois champs sont NULLABLES : les comptes déjà créés par lien n'en ont
-- pas, et les rendre obligatoires les casserait. Le formulaire d'inscription
-- les exige, la base ne le peut pas.
--
-- `birth_date` est une DATE, pas un datetime : une date de naissance n'a pas
-- d'heure, et lui en donner une la décalerait d'un jour selon le fuseau.
--
-- Pourquoi la collecter : l'âge minimum de consentement numérique est de
-- 15 ans en France. Sans date de naissance, on ne peut pas le vérifier. Elle
-- n'est utilisée qu'à cela et n'est jamais affichée publiquement.

alter table profiles
  add column first_name varchar(60) null,
  add column last_name  varchar(60) null,
  add column birth_date date null;

-- ── Réinitialisation de mot de passe ──────────────────────────────────────
--
-- Table séparée de `verification_tokens`, qui appartient à Auth.js et sert
-- aux liens de connexion. Les mélanger ferait qu'un jeton de réinitialisation
-- pourrait servir de jeton de connexion, ou l'inverse — deux pouvoirs
-- différents sous le même nom.
--
-- Seule l'EMPREINTE du jeton est stockée. Le jeton en clair n'existe que dans
-- le courriel envoyé : une fuite de la base ne permet donc pas de prendre la
-- main sur les comptes, exactement comme pour les mots de passe.

create table if not exists password_resets (
  token_hash char(64) primary key,
  user_id    varchar(36) not null,
  expires    datetime(3) not null,
  used_at    datetime(3) null,
  created_at datetime(3) not null default current_timestamp(3),

  key password_resets_user (user_id),
  key password_resets_expires (expires),
  constraint password_resets_user_fk foreign key (user_id) references users (id) on delete cascade
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

-- ┌────────────────────────────────────────────────────────────────────────
-- │ 0005_profil_complet.sql
-- └────────────────────────────────────────────────────────────────────────

-- ═══════════════════════════════════════════════════════════════════════════
--  Le profil devient un vrai profil
-- ═══════════════════════════════════════════════════════════════════════════
--
--  Jusqu'ici un profil tenait en un nom affiché. Il gagne une photo, une
--  localisation déclarative, une présentation et des préférences d'envoi.
--
--  ── Trois décisions, et leurs raisons ─────────────────────────────────────
--
--  1. TOUT EST NULLABLE. Les comptes existants n'ont rien de cela, et rendre
--     un champ obligatoire les casserait. Le formulaire peut exiger ce qu'il
--     veut ; la base, elle, doit accepter ce qui existe déjà.
--
--  2. LA LOCALISATION EST DÉCLARATIVE, jamais mesurée. Une ville écrite à la
--     main, pas une position. Le site n'a aucune raison de savoir où se
--     trouve quelqu'un — savoir d'où il pêche d'habitude suffit à situer ses
--     témoignages, et c'est lui qui le dit.
--
--  3. LES PRÉFÉRENCES ONT DES DÉFAUTS OPPOSÉS. Les alertes de sortie sont
--     activées : on ne les reçoit que pour une sortie qu'on a soi-même
--     programmée, en la demandant. Les nouvelles du site sont désactivées :
--     personne n'a demandé à en recevoir en créant un compte, et un défaut à
--     « oui » serait un consentement présumé.

alter table profiles
  -- Chemin relatif dans le stockage des photos, même arborescence que les
  -- prises : il commence par l'identifiant du propriétaire, ce qui est ce
  -- qui remplace le cloisonnement que PostgreSQL appliquait.
  add column avatar_path     varchar(255) null,

  add column city            varchar(80)  null,
  add column country         varchar(60)  null,
  add column bio             varchar(280) null,

  add column notify_outings  tinyint(1) not null default 1,
  add column notify_news     tinyint(1) not null default 0,

  add column updated_at      datetime(3) not null default current_timestamp(3) on update current_timestamp(3);

-- ┌────────────────────────────────────────────────────────────────────────
-- │ 0006_prises_publiques_ou_privees.sql
-- └────────────────────────────────────────────────────────────────────────

-- ════════════════════════════════════════════════════════════════════════════
--  Une prise est publique ou privée, et c'est son auteur qui décide.
-- ════════════════════════════════════════════════════════════════════════════
--
-- Jusqu'ici, déclarer une prise la publiait sur la page du spot, sans autre
-- choix que de ne pas la déclarer. Or les deux usages coexistent : tenir son
-- carnet pour soi, et raconter aux autres ce qui mord. Un pêcheur qui ne veut
-- pas signaler qu'un poste donne bien ne devait pas avoir à renoncer à son
-- carnet pour cela.
--
-- ── Le défaut est PRIVÉ, et les prises existantes le deviennent ────────────
--
-- Les lignes déjà en base ont été déclarées quand « déclarer » voulait dire
-- « publier » : leurs auteurs le savaient. On pourrait donc les laisser
-- publiques. On ne le fait pas : entre supposer un consentement et le
-- redemander, on redemande. Chacun rendra publiques celles qu'il veut, depuis
-- son carnet.
--
-- `varchar` et non `enum` : ajouter une valeur à un `enum` MySQL réécrit la
-- table entière, et une troisième visibilité (« amis », un jour) ne doit pas
-- coûter un verrou sur la table la plus écrite du site.

alter table catches
  add column visibility varchar(16) not null default 'privee';

-- L'index de lecture publique sert `forSpot`, qui ne montre que les publiques.
-- Sans lui, chaque page de spot balaierait toutes les prises du site pour en
-- écarter la plupart.
create index catches_publiques on catches (spot_slug, visibility, caught_at);

-- ┌────────────────────────────────────────────────────────────────────────
-- │ 0007_appareils_de_notification.sql
-- └────────────────────────────────────────────────────────────────────────

-- ════════════════════════════════════════════════════════════════════════════
--  Les appareils qui reçoivent les notifications de sortie
-- ════════════════════════════════════════════════════════════════════════════
--
-- L'alerte de la veille part aujourd'hui par courriel. Sur un téléphone, elle
-- devient une notification — c'est le vrai gain de l'application, et la seule
-- chose qu'un site mobile ne peut pas faire.
--
-- Une personne peut avoir plusieurs appareils, et un appareil peut changer de
-- main : la clé primaire est donc le JETON, pas l'utilisateur. Réinstaller
-- l'application produit un nouveau jeton ; l'ancien reste en base jusqu'à ce
-- que la plateforme le déclare périmé, ou que la purge quotidienne le ramasse.
--
-- ── Ce que la table ne contient PAS ───────────────────────────────────────
--
-- Ni modèle d'appareil, ni version du système, ni identifiant publicitaire,
-- ni dernière position. Le jeton et la plateforme suffisent à envoyer une
-- notification ; tout le reste servirait à profiler, et la page de
-- confidentialité affirme qu'on ne le fait pas.
--
-- `label` est le nom que la PERSONNE donne à son appareil, pour pouvoir le
-- reconnaître et le révoquer depuis l'écran Compte. Il est facultatif et
-- déclaratif, jamais relevé sur l'appareil.
--
-- ── La cascade est ce qui tient le droit à l'effacement ───────────────────
--
-- Supprimer un compte doit faire disparaître ses jetons, sans quoi le serveur
-- continuerait d'envoyer des notifications à quelqu'un qui a demandé à être
-- oublié. C'est la base qui le garantit, pas une suite d'appels qu'on
-- pourrait oublier d'écrire.
--
-- `varchar` et non `enum` pour la plateforme : ajouter une valeur à un `enum`
-- MySQL réécrit la table entière.

create table if not exists push_devices (
  token varchar(255) not null,
  user_id char(36) not null,
  platform varchar(16) not null,
  label varchar(60) null,
  created_at datetime(3) not null default current_timestamp(3),
  last_seen_at datetime(3) not null default current_timestamp(3),
  primary key (token),
  constraint push_devices_user foreign key (user_id) references users (id) on delete cascade
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

-- L'envoi des alertes part d'un utilisateur et cherche ses appareils : c'est
-- le seul chemin de lecture, et il mérite son index.
create index push_devices_par_compte on push_devices (user_id);

-- ── Marquer ces migrations comme appliquées ───────────────────────────────
--
-- « insert ignore » : réimporter ce fichier ne fausse pas les dates déjà
-- enregistrées.

insert ignore into schema_migrations (filename, checksum) values
  ('0001_comptes_et_contributions.sql', '4e77254d10296803eafb3e0ac08b52d7241f4244efa29041def81d01941c632e'),
  ('0002_favoris_et_sorties.sql', 'eaa07f08307b369bbe96a956e0afe825e30df5ad9869e02d82fa3eddb3fe1dc2'),
  ('0003_limites_de_debit.sql', '64a4355eeef2f0b3437aba87bf83990c41153c20cf8e08fbf2d556eaa5b57d43'),
  ('0004_mot_de_passe_et_identite.sql', 'fcb611169d3361bad6256e179722c6ca730440d811dad8ec2bcb279003c39e14'),
  ('0005_profil_complet.sql', '4fe3613fb39662bb297c23ab8fbbe381854a8f09790e7f7f387681272b4f61a7'),
  ('0006_prises_publiques_ou_privees.sql', '91559573021ac0f65736944a842986a2e60482bde1aa6b4a7c7d733950051b2b'),
  ('0007_appareils_de_notification.sql', 'a983827cf917fc71e9fb38a753f8ebb7b9271125c383cd06b9d0ae54fe10ccbe');
