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
