# Déployer Moonfish sur Hostinger (Web Apps)

## Ce qui est manuel, ce qui ne l'est pas

**Manuel, une seule fois** : créer la Web App dans hPanel. Personne d'autre que
vous ne peut le faire — cela demande vos identifiants Hostinger, et aucun accès
programmatique n'est fourni ici. Comptez cinq minutes.

**Automatique ensuite** : Hostinger reconstruit à chaque poussée sur la branche
connectée, et détecte Next.js tout seul. Une fois le lien établi, les commits
deviennent des déploiements sans intervention.

Autrement dit : vous faites le branchement, je fais le reste.

### Et les identifiants ?

Ils ne sortent pas de hPanel. Pas de mot de passe MySQL, pas d'identifiant
Hostinger, pas de clé SMTP dans une conversation, un ticket ou un fichier du
dépôt : une conversation se conserve, se recopie et s'exporte, et un secret qui
y est passé doit être considéré comme connu — donc changé.

Ce n'est pas une limite : rien n'en a besoin. Vous collez les variables dans le
panneau, Hostinger les injecte dans l'application, et le dépôt ne contient que
la mécanique qui s'en sert. Le schéma se met à jour tout seul au démarrage
(voir §5), sans qu'aucun accès à la base soit nécessaire depuis l'extérieur.

---

## 1. Créer la Web App

**Sites web → Web Apps → Ajouter un site web**, puis :

| Réglage | Valeur |
| --- | --- |
| Source | dépôt GitHub `nssbelhaj/Moonfish-web-app` |
| Branche | `claude/moonfish-mvp-web-t1l7st` (ou `main` après fusion) |
| Framework | Next.js — détecté automatiquement |
| Commande de build | `npm run build` |
| Commande de démarrage | `npm run start` |
| Version de Node | **20.9 minimum**. Une version 18 échoue avant même la compilation, et le message ne nomme pas la cause. |

`next start` respecte la variable `PORT` que la plateforme impose : il n'y a
rien à adapter dans le dépôt. Vérifié.

## 2. Les variables d'environnement

À renseigner dans le panneau, jamais dans le dépôt.

| Variable | Obligatoire ici | Pourquoi |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | **oui** | Sur Vercel, le domaine est injecté automatiquement. Ailleurs, non : sans cette variable, les URL canoniques, le sitemap et les aperçus de partage pointent vers le domaine de repli `moonfish.fish`. C'est l'oubli le plus coûteux de cette liste, et il ne casse rien de visible — constaté sur le premier déploiement, site en HTTP 200 et sitemap entièrement faux. **Elle est insérée à la COMPILATION : la définir ne suffit pas, il faut redéployer.** Le site l'annonce au démarrage. |
| `STORMGLASS_API_KEY` | non | Sans elle, les marées restent simulées et le site le dit. |
| `TIDE_REAL_SPOTS` | non | Borne la dépense de quota. Voir le README. |
| `DATABASE_URL` | non | Ouvre les comptes, avec l'envoi de courriel. Absente, le site fonctionne et annonce qu'ils sont fermés. |
| `EMAIL_SERVER` et `EMAIL_FROM` | non | Envoi des liens de connexion. Voir `docs/mise-en-service-comptes.md`. |
| `AUTH_SECRET` | avec les comptes | Signe les jetons d'Auth.js. `openssl rand -base64 32`. |
| `AUTH_URL` | avec les comptes | Domaine public, pour construire les liens de connexion. |
| `UPLOADS_DIR` | avec les comptes | **Hors du répertoire de l'application** : un déploiement le remplace, et les photos disparaîtraient. |
| `CRON_SECRET` | non | Ferme `/api/entretien`. Voir ci-dessous. |

## 3. La tâche planifiée

`vercel.json` **ne sert à rien ici** : c'est un fichier propre à Vercel. Sur
Hostinger, la tâche se crée dans hPanel (**Avancé → Tâches Cron**), une fois par
jour :

```
curl -fsS -H "Authorization: Bearer VOTRE_CRON_SECRET" https://votre-domaine/api/entretien
```

Elle purge les sessions et les liens de connexion périmés. Sans base
configurée, la route répond `{"ok":true,"state":"sans-base"}` et ne fait
rien.

## 4. La base se met à jour toute seule

`package.json` déclare :

```json
"prestart": "node scripts/migrer-mysql.mjs --au-demarrage"
```

npm exécute `prestart` avant `start`. Chaque déploiement applique donc les
migrations qui manquent, dans l'ordre, **une seule fois chacune** : la table
`schema_migrations` garde le nom et l'empreinte SHA-256 de celles déjà passées.
Il n'y a aucune commande à lancer à la main après une mise en ligne, et aucun
accès distant à la base à ouvrir.

Ce qui se passe quand ça se passe mal, et pourquoi ce n'est pas uniforme :

| Situation | Effet |
| --- | --- |
| Pas de `DATABASE_URL` | on passe, sans bruit. Le site sans comptes est un mode prévu. |
| Base injoignable | **avertissement, et le site démarre quand même.** Marées, météo, guides et score n'en dépendent pas ; les comptes restent fermés le temps que la base revienne, et le site le dit. |
| Une migration échoue | **arrêt.** Le déploiement échoue et la version précédente reste en ligne — plutôt que de faire tourner du code contre un schéma à moitié migré, ce qui corrompt en silence. |
| Une migration déjà passée a été modifiée | **refus.** La base garderait l'ancienne forme et le dépôt afficherait la nouvelle. Il faut une nouvelle migration, pas une retouche. |

Pour l'appliquer manuellement depuis un poste ayant accès à la base :
`npm run migrate`. Là, une base injoignable est une erreur : on a demandé une
migration.

### Si vous préférez importer le schéma à la main

`db/import-manuel.sql` contient tout en un seul fichier :
**phpMyAdmin → votre base → Importer → Exécuter**. Choisissez la base AVANT :
le fichier n'en crée ni n'en sélectionne aucune, exprès — sur un hébergement
mutualisé, son nom est imposé par le panneau.

Ce n'est **pas nécessaire** : `prestart` fait la même chose tout seul. C'est un
recours pour le cas où vous n'auriez pas de terminal.

Sa dernière section inscrit chaque migration comme déjà appliquée, avec son
empreinte. Sans elle, le premier démarrage les rejouerait toutes. Le fichier
est donc **généré** (`npm run import-sql`) et jamais écrit à la main : une
empreinte recopiée vieillit en silence, et périmée elle arrêterait le
déploiement suivant sur « a CHANGÉ depuis son application » — un refus juste
pour une cause fausse. L'intégration continue échoue si le fichier a vieilli.

Le réimporter est sans danger : tout est en `create table if not exists`, et
l'inscription est en `insert ignore`.

## 5. Après le premier déploiement

À vérifier dans l'ordre, parce que chacun de ces points échoue silencieusement :

1. la page d'accueil répond ;
2. `curl -s https://votre-domaine/sitemap.xml | head` — les URL doivent porter
   VOTRE domaine. Si elles disent `moonfish.fish`, `NEXT_PUBLIC_SITE_URL`
   manque ;
3. une page de spot s'affiche avec ses marées, et la mention de fraîcheur en bas
   dit la vérité sur la source réellement utilisée ;
4. `/confidentialite` décrit le bon état : « aucun cookie » sans comptes, le
   cookie de session avec ;
5. `/api/entretien` répond, avec l'en-tête si `CRON_SECRET` est défini ;
6. si les comptes sont ouverts : demandez-vous un lien de connexion et
   **vérifiez qu'il arrive**. Un lien qui n'arrive pas ressemble, pour la
   personne, à une adresse refusée.

---

## Hostinger ou Vercel ?

Les deux fonctionnent. Ce qui les sépare vraiment :

| | Vercel Hobby | Hostinger Business |
| --- | --- | --- |
| Coût | gratuit | déjà payé jusqu'en 2027 |
| **Usage commercial** | **interdit** — publicité ou paiement imposent le plan Pro à 20 $/mois | autorisé |
| Tâches planifiées | une par jour, déclarée dans `vercel.json` | cron hPanel, sans limite de fréquence |
| Rendu incrémental (ISR) | natif, cache distribué | fonctionne sur le disque de l'instance |
| Effort de bascule | déjà en place | cinq minutes de configuration |

Tant que Moonfish n'affiche ni publicité ni paiement — c'est le cas, et les dons
ne comptent pas — le plan Hobby est parfaitement régulier. Le jour où le site se
monétise, il ne l'est plus, et Hostinger devient l'option évidente puisqu'elle
est déjà réglée.

Rien n'oblige à choisir tout de suite : les deux peuvent servir le même dépôt en
parallèle, sur deux domaines différents, le temps de comparer.

---

## La base

Elle est chez Hostinger elle aussi : MySQL managé, inclus dans le plan,
identifiants câblés dans l'application, sauvegardes quotidiennes. L'application
et la base étant sur le même hôte, il n'y a aucune autorisation d'adresse IP à
gérer — c'est ce qui rend cette configuration possible là où un hébergement
serverless ne le permettait pas.

Le pas-à-pas est dans `docs/mise-en-service-comptes.md`.
