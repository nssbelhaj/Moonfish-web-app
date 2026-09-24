-- ═══════════════════════════════════════════════════════════════════════════
--  L'alerte sur un spot favori
-- ═══════════════════════════════════════════════════════════════════════════
--
-- « Prévenez-moi quand Le Crotoy passe au-dessus de 8. » C'est la raison de
-- revenir sur le site sans y penser : le site vient à vous. Un favori porte
-- donc un seuil facultatif ; la tâche d'entretien cherche, pour chaque favori
-- qui en a un, le meilleur créneau des 36 prochaines heures, et écrit si le
-- score l'atteint.
--
-- `alerted_slot` est le DÉBUT du créneau déjà annoncé : la tâche tourne
-- chaque jour, un même créneau reste dans la fenêtre deux passages de suite,
-- et il ne doit être annoncé qu'une fois. Un créneau différent, lui, l'est —
-- c'est une information nouvelle.
--
-- `null` = pas d'alerte : le défaut, pour tous les favoris existants. Publier
-- un seuil est un geste, jamais une conséquence.

alter table favorites
  add column alert_min_score tinyint unsigned null,
  add column alerted_slot datetime(3) null;

alter table favorites
  add constraint favorites_alert_ck check (alert_min_score is null or alert_min_score between 1 and 10);
