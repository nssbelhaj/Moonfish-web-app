-- ═══════════════════════════════════════════════════════════════════════════
--  Le compteur de pages vues
-- ═══════════════════════════════════════════════════════════════════════════
--
-- La page de confidentialité l'annonçait comme règle : « toute mesure
-- d'audience, si elle arrive, sera soit sans cookie et sans identifiant, soit
-- soumise à votre consentement ». C'est la première voie.
--
-- Une ligne par jour et par chemin, avec un compte. C'est TOUT : ni adresse
-- IP, ni agent utilisateur, ni identifiant de session, ni provenance, ni
-- pays. On ne peut donc pas savoir si dix vues sont dix personnes ou une —
-- et c'est le prix, accepté, d'une mesure qui ne demande de consentement à
-- personne parce qu'elle ne concerne personne.
--
-- Le chemin est celui de la page, sans paramètres : `/compte?next=…` est
-- compté comme `/compte`. Aucun chemin du site ne porte de donnée
-- personnelle ; une adresse de réinitialisation porte un jeton, dans les
-- paramètres, qui ne sont jamais enregistrés.

create table if not exists visites (
  jour    date not null,
  chemin  varchar(200) not null,
  n       int unsigned not null default 0,

  primary key (jour, chemin)
) engine = InnoDB default charset = utf8mb4 collate = utf8mb4_unicode_ci;
