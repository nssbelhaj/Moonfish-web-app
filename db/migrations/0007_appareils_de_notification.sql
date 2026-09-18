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
