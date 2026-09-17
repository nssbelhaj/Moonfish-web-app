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
