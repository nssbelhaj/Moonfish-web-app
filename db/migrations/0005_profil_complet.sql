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
