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
