-- ═══════════════════════════════════════════════════════════════════════════
--  Les tables de marée, conservées
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Une marée est de l'astronomie : elle se connaît des semaines à l'avance et
-- ne change pas d'une heure à l'autre. Le site l'interrogeait pourtant comme
-- une météo — une requête par spot et par jour, dans un cache qui mourait à
-- chaque build et à chaque redéploiement. Sur un palier gratuit de dix
-- requêtes par jour, quarante-deux spots ne tenaient pas, et « TIDE_REAL_SPOTS »
-- réduisait le site réel à trois spots.
--
-- Cette table retient, pour chaque point interrogé, les extremums rendus par
-- le fournisseur sur une fenêtre de plusieurs jours. Tant que la fenêtre
-- couvre ce qu'une page affiche, aucune requête ne part. Une ligne se
-- rafraîchit quand sa couverture ne suffit plus — une fois par semaine
-- environ — et la tâche d'entretien le fait à l'avance, dans un budget
-- journalier. Quarante-deux spots, six requêtes par jour : le palier gratuit
-- suffit, et le bandeau « marées simulées » disparaît.
--
-- ── Ce que la ligne contient ─────────────────────────────────────────────
--
-- `point_slug` est le slug d'un spot, ou `brest` : le coefficient français
-- est défini sur le marnage de Brest, il faut donc la table de Brest pour
-- calculer celui de n'importe quel spot.
--
-- `covers_from` / `covers_to` sont les bornes OBSERVÉES des extremums rendus,
-- pas celles demandées : si le fournisseur rend moins que demandé, la ligne
-- le dit, et la couverture insuffisante déclenche un rafraîchissement plus
-- tôt au lieu de laisser des journées sans marée.
--
-- `extremes` est un JSON `[{ time, heightM, type }]`, en `longtext` et non
-- en `json` : MariaDB ne connaît `json` que comme alias, et une contrainte de
-- validité qu'un seul des deux moteurs applique n'est pas une garantie.
--
-- Aucune donnée personnelle : des heures de marée, publiques par nature.

create table if not exists tide_tables (
  point_slug   varchar(64) not null,
  covers_from  datetime(3) not null,
  covers_to    datetime(3) not null,
  extremes     longtext not null,
  source_name  varchar(120) not null,
  fetched_at   datetime(3) not null,

  primary key (point_slug)
) engine = InnoDB default charset = utf8mb4 collate = utf8mb4_unicode_ci;
