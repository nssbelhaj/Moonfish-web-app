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
