# Mise en service des comptes

Ce que ce document couvre : passer d'un dépôt qui compile à des comptes qui
fonctionnent réellement, avec les points où ça coince en pratique.

Rien de tout cela n'est nécessaire pour que le site tourne. Sans Supabase,
Moonfish fonctionne entièrement et annonce que les comptes ne sont pas ouverts.
Cette étape n'a de sens que le jour où vous voulez des avis et des prises.

---

## 0. La limite qui décide de tout : deux projets actifs

Le palier gratuit de Supabase donne droit à **deux projets ACTIFS**, et cette
limite vaut pour toutes vos organisations confondues — en créer une deuxième ne
débloque rien.

En revanche, **un projet en pause ne compte pas dans le quota**. Vous avez donc
un mécanisme de rotation :

1. mettez en pause un projet dont vous ne vous servez pas aujourd'hui ;
2. relancez celui de Moonfish (bouton *Resume project*, une à deux minutes) ;
3. inversez quand vous changez de chantier.

Les données d'un projet en pause restent intactes, et le tableau de bord
indique jusqu'à quelle date il reste relançable.

Un projet en pause **ne se réveille pas tout seul** : ni une requête, ni la
tâche planifiée `/api/keep-alive` ne le relancent. Seul un clic depuis le
tableau de bord le fait. La tâche planifiée sert à *empêcher* la pause, jamais
à en sortir.

---

## 1. Créer le projet

- Région : **une région de l'Union européenne**. Ce n'est pas un détail de
  conformité abstrait — c'est ce qui évite un transfert hors UE à documenter
  dans la politique de confidentialité.
- Notez le mot de passe de la base : il ne réapparaîtra plus.

## 2. Exécuter la migration

Ouvrez `supabase/migrations/0001_comptes_et_contributions.sql`, copiez tout,
collez dans **SQL Editor** du projet, exécutez.

Elle crée les quatre tables, leurs politiques de sécurité au niveau des lignes,
le seau de photos et son cloisonnement par utilisateur. Elle est idempotente :
la relancer ne casse rien.

## 3. Renseigner les variables

Dans `.env.local` en développement, et dans les variables d'environnement du
projet Vercel en production :

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=…
SUPABASE_SERVICE_ROLE_KEY=…      # facultatif, voir plus bas
CRON_SECRET=…                     # une chaîne aléatoire quelconque
```

Les deux premières se trouvent dans **Project Settings → API**.

`SUPABASE_SERVICE_ROLE_KEY` ne sert qu'à **une** chose : effacer un compte dans
`auth.users`, ce qu'un utilisateur ne peut pas faire lui-même. Sans elle, la
suppression de compte refuse explicitement au lieu de faire semblant — ce qui
est correct, mais laisse une demande d'effacement à traiter à la main.

## 4. Autoriser l'URL de retour

**Authentication → URL Configuration → Redirect URLs**, ajouter :

```
https://votre-domaine/auth/callback
http://localhost:3000/auth/callback
```

C'est le point qui échoue le plus souvent, et le message d'erreur ne le désigne
pas : les liens de connexion partent, mais le retour est refusé.

Si vous déployez sur des URL de prévisualisation Vercel, ajoutez aussi le motif
générique de votre projet — chaque prévisualisation a un domaine différent.

## 5. Vérifier

```bash
node scripts/verifier-supabase.mjs
```

Le script contrôle, avec la seule clé publique :

- que le projet répond (et nomme la pause comme cause si ce n'est pas le cas) ;
- que les tables publiques existent et sont lisibles ;
- que les profils et la liste d'attente **refusent** un visiteur anonyme —
  c'est le contrôle qui compte : une table sans RLS est lisible par quiconque
  possède la clé publique, laquelle est dans chaque navigateur ;
- que le seau `prises` existe.

`--ecrire` teste en plus une insertion dans la liste d'attente ; elle laisse une
ligne à supprimer, d'où le fait qu'elle ne soit pas faite par défaut.

## 6. Le parcours complet, à la main

Un script ne peut pas vérifier une boîte aux lettres. À faire une fois :

1. `/compte` → saisir une adresse, cocher le consentement, demander le lien ;
2. ouvrir le lien reçu → vous devez revenir connecté ;
3. choisir un nom affiché ;
4. sur un spot, onglet **Espèces** → publier un avis, puis le voir apparaître ;
5. déclarer une prise **avec photo** → vérifier que l'image s'affiche ;
6. `/compte` → télécharger l'export JSON, vérifier qu'il contient bien tout ;
7. `/compte` → supprimer le compte, vérifier que l'avis a disparu du spot.

Le point 7 est le plus important : c'est le droit à l'effacement, et c'est le
seul moyen de constater que la cascade fonctionne.

---

## Envoi des e-mails : la limite qui va vous gêner

Supabase envoie les liens de connexion par son propre serveur, **fortement
limité en débit** sur le palier gratuit : quelques messages par heure. C'est
assez pour se tester soi-même, pas pour une poignée de testeurs, et pas du tout
pour un lancement. Au-delà, les demandes échouent silencieusement pour
l'utilisateur.

La solution est de brancher votre propre SMTP, et un hébergement mutualisé
Hostinger en fournit un avec chaque boîte aux lettres.

**Authentication → Emails → SMTP Settings** :

| Champ | Valeur |
| --- | --- |
| Host | `smtp.hostinger.com` |
| Port | `587` (STARTTLS) — `465` en SSL si 587 est filtré |
| Username | l'adresse complète, par exemple `bonjour@votre-domaine` |
| Password | le mot de passe de cette boîte |
| Sender email | la même adresse |
| Sender name | Moonfish |

Deux remarques :

- l'adresse d'expédition doit appartenir au domaine que vous authentifiez
  (SPF, DKIM) ; envoyer depuis un domaine que vous ne contrôlez pas envoie les
  liens directement dans les indésirables ;
- testez l'envoi **avant** d'ouvrir aux autres : un lien de connexion qui
  n'arrive pas ressemble, pour la personne, à une adresse refusée.

---

## Ce que Hostinger ne remplacera pas

L'hébergement mutualisé ne propose pas de PostgreSQL managé — seulement MySQL —
et la réponse d'Hostinger à « je veux du Postgres » est précisément de connecter
un projet Supabase.

Passer sur leur MySQL supposerait de réécrire :

- **toute la sécurité**, puisque MySQL n'a pas d'équivalent des politiques au
  niveau des lignes : les 200 lignes de la migration remonteraient dans le code
  applicatif, où un oubli de filtre devient une fuite ;
- **l'authentification** entière, jetons et sessions compris ;
- **le stockage** des photos.

Sans compter que l'accès distant à un MySQL mutualisé se filtre par adresse IP
autorisée, ce qui ne fonctionne pas avec un hébergement serverless dont les
adresses changent.

Ce que Hostinger apporte vraiment ici : le **SMTP** ci-dessus, le **domaine** à
faire pointer sur l'hébergement du site, et — si votre offre est Business ou
cloud — la possibilité d'héberger l'application Next.js elle-même.
