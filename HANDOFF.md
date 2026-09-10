# HANDOFF — Luna Marea

> Document de passation. Il s'adresse à quelqu'un — humain ou assistant — qui
> reprend ce projet sans en connaître l'histoire. Il dit ce qu'on a voulu
> faire, ce qui a été décidé **et pourquoi**, ce qui reste, et surtout les
> pièges qui ont coûté du temps.
>
> Dernière mise à jour : 9 septembre 2026 · branche `claude/moonfish-mvp-web-t1l7st`

---

## 1. Objectif

**Luna Marea dit quand aller pêcher du bord, spot par spot, et explique
pourquoi.**

Un score sur 10 par créneau de deux heures, sur sept jours, pour quarante-deux spots de
pêche du bord en France et au Maroc. Le score agrège marée, vent, houle,
périodes solunaires, pression et lumière — chaque facteur étant affiché avec
son poids, de sorte que la note ne soit jamais un verdict à croire sur parole.

### Les trois règles qui définissent le produit

Elles ne sont pas négociables. Tout le reste en découle, et plusieurs tests
existent uniquement pour les faire respecter.

| Règle | Ce qu'elle interdit |
| --- | --- |
| **La sécurité prime sur le score** | Houle > 2,5 m **ou** vent > 50 km/h ⇒ bandeau danger, affiché **au-dessus** du score et **jamais dérivé de lui**. Un créneau noté 8,7 peut être dangereux ; le bandeau ne se ferme pas. |
| **Aucune donnée inventée sans le dire** | Toute donnée simulée porte un cadre pointillé et une mention. Les avis et prises, eux, ne sont **jamais** simulés : une marée inventée illustre un mécanisme, un faux témoignage est un faux témoignage. |
| **Aucune promesse de prise** | Le site dit quand les conditions sont favorables. Il ne dit pas que ça mordra. Le pied de page le répète. |

---

## 2. Architecture et choix techniques

### Pile

| | | Pourquoi |
| --- | --- | --- |
| **Next.js 15.5.25**, App Router | React 19.1.1 | Server Components par défaut, ISR à l'heure. Le site est consulté **au bord de l'eau en 4G faible** : chaque kilo-octet de JavaScript se justifie. |
| **TypeScript strict renforcé** | `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, `noUnused*` | Aucun `any`, aucun `@ts-ignore`. Une seule concession documentée, à la frontière d'Auth.js (`src/auth.ts`). |
| **Tailwind + jetons sémantiques** | `src/app/tokens.css` | Aucune couleur littérale hors des jetons — un test échoue sinon. Deux thèmes, clair et nuit. |
| **Zod 3.25** | `src/data/schemas.ts` | **La frontière de confiance** : tout ce qui vient d'un formulaire ou de la base y passe. |
| **MySQL 8 / MariaDB** | `mysql2` | Imposé par Hostinger : leur offre mutualisée ne propose pas PostgreSQL. Voir la garantie perdue, plus bas. |
| **Auth.js v5** (beta.32) | adaptateur MySQL écrit à la main | Lien par courriel, **pas de mot de passe** : ce qu'on ne stocke pas ne peut pas fuir. Sessions **en base**, donc une déconnexion prend effet immédiatement. |
| **Leaflet 1.9.4** | `/carte` uniquement | Seul écran interactif du site. 103 → 107 ko de JS initial, la bibliothèque arrivant dans un fragment séparé. |

### Le point de bascule des données

`src/lib/providers/index.ts` est **le seul fichier à modifier** pour passer des
données simulées aux vraies. Aucune page, aucun composant, aucun module de
score n'importe une implémentation : tous passent par les interfaces de
`src/lib/providers/types.ts`.

| Fournisseur | Réel si | Sinon |
| --- | --- | --- |
| Marées | `STORMGLASS_API_KEY` | modèle de démonstration, annoncé |
| Météo marine | Open-Meteo, **branché** (sans clé) | repli simulé si panne |
| Spots | — | fichier éditorial `src/data/spots.ts` |
| Liste d'attente | `DATABASE_URL` | fichier local, éphémère |
| Contributions | base **et** courriel | implémentation **fermée** — qui refuse, sans rien simuler |

Le soleil et la Lune ne sont pas un fournisseur : ils sont **calculés
localement** (`src/lib/astro`, NOAA + séries de Meeus ELP-2000 abrégée),
validés contre l'exemple 47.a de Meeus. Aucun réseau, aucun cache.

### Le score

`src/lib/scoring/compute.ts` — fonction **pure** : mêmes entrées, même sortie,
aucun réseau, aucune horloge, aucun système de fichiers.

| Facteur | Poids nominal |
| --- | --- |
| Marée | 0,32 |
| Vent | 0,23 |
| Houle | 0,18 |
| Solunaire | 0,13 |
| Pression | 0,09 |
| Lumière | 0,05 |

**Renormalisation** : un facteur dont la source manque sort du calcul, et les
poids restants sont renormalisés pour que le total reste sur 10 et reste
comparable. Le site dit alors ce qui manque plutôt que de noter zéro.

### Le rendu : ce qui est statique, et pourquoi ça compte

77 pages sont pré-rendues avec revalidation à l'heure. **Lire les cookies dans
une page bascule toute la route en rendu dynamique** — c'est la contrainte
structurante de ce projet, et elle explique plusieurs choix qui paraissent
sinon tortueux :

- les contributions publiques sont lues **sans session**, pour que la page
  Espèces reste pré-rendue ;
- l'état de session est résolu côté client via `/api/compte/etat` (bouton
  favori, panneau de contribution) ;
- les onglets de la page Prévision utilisent `:target` + `:has()` en CSS pur —
  zéro JavaScript, adresse partageable, et dégradation vers l'ancien
  empilement si `:has()` manque.

### La garantie perdue au passage à MySQL, et ce qui la remplace

PostgreSQL appliquait la sécurité au niveau des lignes : la base **elle-même**
refusait une écriture au nom d'autrui. MySQL n'a pas d'équivalent. La garantie
est devenue conventionnelle, et une convention que rien ne vérifie ne vaut
rien. Trois mécanismes la remplacent :

1. **Signatures obligatoires** — `deleteReview(id, userId)` : le compilateur
   refuse un appel sans propriétaire ;
2. **`src/lib/db/__tests__/proprietaire.test.ts`** — lit le SQL du dépôt et
   échoue si un `update`/`delete` sur une table détenue ne porte pas
   `user_id = ?`, si du SQL apparaît hors des modules autorisés, ou si un
   `select` apparaît sur `waitlist` ;
3. **28 tests d'intégration** contre une vraie base, dont « REFUSE de supprimer
   l'avis d'un autre ».

C'est **plus faible** qu'une politique appliquée par le moteur. Le dire est
plus utile que faire comme si le modèle n'avait pas changé.

### Vie privée : une promesse tenue par des tests

`/confidentialite` affirme qu'aucune requête ne part du navigateur vers un
tiers. `src/lib/__tests__/privacy-claims.test.ts` attache cette phrase au code :
il compte les points d'écriture dans le navigateur et exige l'égalité avec
`CLIENT_STORAGE`, et interdit toute URL externe dans un composant client.

C'est ce qui a dicté l'architecture de la carte : les tuiles OpenStreetMap
passent par **notre serveur** (`/api/tuiles/[z]/[x]/[y]`). Mesuré dans un
navigateur sur un chargement complet : **un seul hôte joint, le nôtre**.

---

## 3. Ce qui est fait

### Le site public

- **42 spots** en France, en Espagne et au Maroc, sur les deux façades,
  4 onglets chacun : Live, Prévision, Analyse, Espèces
- **Score** avec 4 canaux redondants (chiffre, couleur, forme, texte) et
  détail du calcul facteur par facteur
- **Tableau des créneaux** : chaque ligne porte ses facteurs — note, marée avec
  écart à la pleine mer (« PM +2 h 30 »), vent et rafales avec secteur, houle et
  période, lumière
- **Prévision 7 jours en onglets**, sans une ligne de JavaScript
- **Carte à tuiles** interactive, marqueurs cliquables, tuiles relayées
- **4 guides** éditoriaux, page Données, deux pages légales complètes
- Deux thèmes, recherche, filtres, sitemap, JSON-LD, images de partage

### Les comptes

Connexion par lien, sans mot de passe. Ce qu'un compte permet :

| | Visible par |
| --- | --- |
| **Carnet de prises** — par espèce avec la plus grande taille, par spot, part relâchée, douze derniers mois | vous seul |
| **Spots favoris** — avec le score du moment et la prochaine bonne fenêtre | vous seul |
| **Sorties programmées** — date, seuil de score facultatif, note | vous seul |
| **Alerte de la veille** — un courriel, un seul, danger en premier | vous seul |
| **Avis et prises** — sous le nom affiché | tout le monde |

**RGPD** : export JSON complet en un clic, effacement immédiat sans copie de
sauvegarde, photos débarrassées de leurs métadonnées **sur l'appareil** avant
envoi, traçabilité du consentement avec sa version.

### L'exploitation

- **Déploiement automatique** à chaque poussée (Hostinger ↔ GitHub)
- **Migrations automatiques** avant chaque démarrage (`prestart`), avec
  registre et empreintes SHA-256
- **Intégration continue** — typage, lint, migrations, migrations rejouées,
  cohérence du fichier d'import, tests **contre un vrai MySQL 8**, build
- **`npm audit` à zéro** sans quitter Next 15
- **Budgets d'appel en base** (table `rate_limits`) : durables, partagés entre
  instances, purgés par la tâche d'entretien. Le formulaire de connexion en
  consomme trois — par adresse, par IP, et un plafond global qui protège le
  quota d'envoi du serveur de courriel
- **Diagnostic en ligne** — `/api/diagnostic` rend l'état de chaque variable
  d'environnement en français, avec le remède, sans jamais recopier un secret
- **666 tests** (54 fichiers), dont 40 d'intégration

### Ce qui n'a jamais pu être vérifié

Mon environnement d'exécution ne joint ni votre domaine, ni les serveurs de
tuiles, ni les fournisseurs météo. Tout ce qui est décrit comme « vérifié » l'a
été **localement**, contre une vraie MariaDB et un vrai serveur SMTP.

1. **Que la base soit branchée en production.** `curl https://lunamarea.fr/api/entretien`
   répond `"state":"entretenu"` si oui, `"sans-base"` si non.
2. **Qu'un courriel arrive.** SPF, DKIM et réputation du domaine sont hors de
   portée de tout test. C'est le seul maillon qu'aucun code ne couvrira jamais.
3. **Le rendu des vraies tuiles OpenStreetMap.** Mécanique prouvée avec un
   serveur de tuiles local ; aspect final à voir en ligne.

---

## 4. Ce qui reste à faire

### Bloc A — mise en ligne (aucun code, ~30 min)

1. **Pointer `lunamarea.fr`** sur la Web App dans hPanel.
2. **Renseigner les variables**, puis **redéployer** — `NEXT_PUBLIC_SITE_URL`
   est insérée à la **compilation**, la définir sans reconstruire ne fait rien :
   ```
   NEXT_PUBLIC_SITE_URL=https://lunamarea.fr
   AUTH_URL=https://lunamarea.fr          # obligatoire, voir piège n° 5
   AUTH_SECRET=<openssl rand -base64 32>
   DATABASE_URL=mysql://UTILISATEUR:MOTDEPASSE@localhost:3306/u969082232_moonfish
   EMAIL_SERVER=smtp://contact%40lunamarea.fr:MOTDEPASSE@smtp.hostinger.com:587
   EMAIL_FROM=contact@lunamarea.fr
   UPLOADS_DIR=/home/VOTRE-COMPTE/luna-marea-photos   # HORS du répertoire de l'app
   CRON_SECRET=<autre openssl rand>
   ```
3. **Créer la tâche cron**, une fois par jour vers 18 h :
   ```
   curl -fsS -H "Authorization: Bearer VOTRE_CRON_SECRET" https://lunamarea.fr/api/entretien
   ```
   Sans elle, **aucune alerte de sortie ne part jamais**.
4. **Vérifier** — chacun de ces points échoue en silence :
   ```bash
   # Le plus utile en premier : il répond pour tous les autres.
   curl -s -H "Authorization: Bearer VOTRE_CRON_SECRET" https://lunamarea.fr/api/diagnostic
   # Ajouter ?smtp=1 ouvre une VRAIE connexion au serveur d'envoi.

   curl -s  https://lunamarea.fr/sitemap.xml | head -5   # doit dire lunamarea.fr
   curl -s  https://lunamarea.fr/api/entretien           # "entretenu" = base OK
   curl -sI https://lunamarea.fr/api/tuiles/8/127/88     # sans x-luna-marea-tuile = OSM OK
   ```
5. **Demander un lien de connexion et vérifier qu'il arrive.** Indésirables
   d'abord, SPF/DKIM ensuite.

### Bloc B — produit (par valeur décroissante)

6. **Clé Stormglass** pour des marées réelles. `TIDE_REAL_SPOTS` est
   OBLIGATOIRE : le catalogue compte 42 spots, soit 43 appels par construction
   contre 10 par jour au palier gratuit. Trois spots = 4 appels par jour.
   **C'est le premier changement qu'un pêcheur remarquerait** : ailleurs les
   marées restent simulées et le site le dit sur chaque page.
7. **Passer les spots en base**, mais seulement le jour où une interface
   d'édition existe. Aujourd'hui c'est du contenu éditorial écrit à la main ;
   le mettre en base sans interface n'apporterait rien.

### Bloc C — si monétisation

8. **Un lien d'affiliation ou un bouton de don rend le site commercial.** Trois
   choses changent en même temps, et `regime-publication.test.ts` échoue tant
   qu'elles ne sont pas faites :
   - `PUBLICATION_REGIME` passe à `professionnel` et **l'adresse postale
     redevient obligatoire** (art. 6-III-1 LCEN) ;
   - la relation commerciale doit être divulguée sur les pages concernées ;
   - si un lien dépose un traceur, la page de confidentialité — qui affirme
     n'en poser **aucun** — devient fausse, et un recueil de consentement
     devient nécessaire.

   Pour ne pas publier une adresse personnelle : micro-entreprise + société de
   domiciliation (15–40 €/mois). Une boîte postale ne suffit pas.

---

## 5. Pièges rencontrés

### Les six pannes silencieuses

Aucune ne levait d'erreur. Chacune se présentait sous un déguisement — c'est ce
qui les rendait coûteuses. **Toutes ont maintenant un avertissement au
démarrage** (`src/instrumentation.ts`).

| Ce qu'on voyait | Ce que c'était |
| --- | --- |
| Site parfait, sitemap annonçant un autre domaine | `NEXT_PUBLIC_SITE_URL` absente — et **insérée à la compilation**, donc la définir sans reconstruire ne change rien |
| « Aucune base configurée » alors que la variable était renseignée | un `/` dans le mot de passe casse l'URL ; le code confondait « illisible » et « absente » |
| « Le serveur d'envoi ne répond pas » | un `/`, `?`, `#` ou `%` dans le mot de passe SMTP **détourne la connexion vers votre propre domaine, avec un mot de passe vide**. Le `@` de l'identifiant, lui, n'a rien à encoder — la documentation affirmait le contraire, c'était faux |
| Une garde documentée qui protégeait les photos | `storageWarning()` n'était **appelée nulle part** |
| Formulaire de connexion normal, demande en 500, aucun courriel **jamais** | `AUTH_URL` absente ⇒ Auth.js refuse chaque requête (`UntrustedHost`) hors Vercel et hors développement |

### Les migrations appliquées sont IMMUABLES

Le script garde l'empreinte SHA-256 de chaque migration appliquée et refuse
tout fichier modifié depuis — **y compris pour un simple commentaire**. Mesuré
lors du renommage : changer le seul titre d'en-tête de `0001` fait sortir le
script en 1 et **casse le déploiement suivant**.

C'est pourquoi « Moonfish » subsiste définitivement dans l'en-tête des deux
migrations, et pourquoi `marque.test.ts` les exempte nommément. `db/import-manuel.sql`
est différent : il est **généré**, et son propre en-tête n'entre pas dans les
empreintes.

Corollaire : **on ne modifie jamais une migration passée, on en crée une
nouvelle.**

### Les schémas Zod doivent être IDEMPOTENTS

Ils sont appliqués **deux fois** sur le trajet formulaire → dépôt. Le premier
passage transformait un commentaire vide en `null`, et le second refusait
`null`. Résultat : **tout avis sans commentaire et toute prise sans mesure
étaient rejetés**. Ce défaut avait survécu à toute la version PostgreSQL, faute
de pouvoir l'exécuter.

### Les pages sont pré-rendues avec l'état des comptes

`/especes` est construite au **build** avec `contributions.available`. Bâtie
sans `DATABASE_URL`, elle affiche « Pas encore ouvert » pendant une heure même
si tout fonctionne au démarrage. Chez Hostinger les variables sont présentes au
build — mais c'est à savoir.

### Autres pièges, plus courts

| | |
| --- | --- |
| **Clic sur un marqueur de carte** | Déplacer le *dessin* par CSS ne déplace pas la zone cliquable : Leaflet la garde sur l'élément parent. Le défaut devenait invisible sans disparaître. C'est le marqueur lui-même qu'il faut bouger. |
| **Marqueurs superposés** | Agadir et Taghazout sont à 15 km : à l'échelle des deux pays, l'un recouvrait l'autre **entièrement**. `separatePoints` les écarte, et l'écartement disparaît au zoom. |
| **Ancres de date** | `iso.slice(0,10)` donne la date **UTC**. Pour un minuit parisien, `#jour-2026-09-05` ouvrait « dimanche 6 septembre ». Utiliser `localDateKey`. |
| **Tests d'intégration en parallèle** | Ils partagent une base et chacun vide les tables : 8 à 12 échecs jamais identiques. `fileParallelism: false`. |
| **React réinitialise un formulaire** après une action serveur, **même en échec**. `ActionForm` mémorise et restaure la saisie. |
| **Suppression et pages pré-rendues** | Les données partaient de la base mais restaient **affichées** jusqu'à une heure. Relever les spots concernés **avant** la suppression, revalider après. |
| **Durée annoncée ≠ durée calculée** | Le site annonçait des créneaux de trois heures alors que `SLOT_HOURS` vaut 2 — jusque dans la balise de description. `duree-creneau.test.ts` lit la constante. |
| **Un base64 ne se relit pas à l'œil** | La tuile de repli, commentée « PNG transparent d'un pixel », décodait en `(0, 255, 0, 127)` — vert vif à moitié opaque. Chaque tuile manquante peignait un carré vert sur la carte. Invisible en développement, où les tuiles répondent. `tuile-vide.test.ts` décode le PNG et lit ses quatre composantes. |
| **Un marqueur écarté hors du cadre reste cliquable et invisible** | `separatePoints` n'avait pas de bornes dans Leaflet non plus : six marqueurs sur quarante-deux sortaient du conteneur sur un écran de 390 px. Le cadre fait maintenant partie de la relaxation, ici comme sur la carte statique. |
| **Une migration en échec éteignait TOUT le site** | La politique « arrêt sur échec » supposait qu'une version précédente reste en ligne. Sur un hébergement mutualisé il n'y en a pas : le processus sort en 1, l'hébergeur le relance, il ressort en 1, et le serveur rend un **503 sur tout le site** — marées, météo, carte et guides compris, qui ne touchent jamais la base. Observé en production. Au démarrage, l'échec avertit maintenant et laisse partir ; `MIGRATIONS_STRICT=1` rétablit l'arrêt. |
| **Migrations sautées au démarrage** | `prestart` les lance, donc `npm start` les lance. Un hébergeur qui exécute `next start` directement les saute sans rien dire : la base répond, l'application démarre, il manque des tables. La panne prend alors le visage d'autre chose — une `rate_limits` absente fait répondre au formulaire de connexion « trop de demandes, réessayez dans quinze minutes ». `/api/diagnostic` compare maintenant `schema_migrations` aux fichiers présents. |
| **Un budget pris avant l'action, jamais rendu** | Les trois budgets du formulaire de connexion se consommaient avant l'envoi et n'étaient pas remboursés en cas d'échec. Après trois envois ratés, le site répondait « un lien a déjà été demandé, vérifiez vos indésirables » — envoyant chercher un courriel jamais parti, et masquant la panne réelle un quart d'heure. Observé en production. |
| **Une protection qui existe n'est pas une protection qui s'applique** | Le limiteur de débit était écrit, documenté, testé — et branché sur **un seul** point d'entrée. Le formulaire de connexion, écrit plus tard, faisait partir un courriel vers une adresse fournie par l'appelant, sans compteur. Rien ne le signalait. `limites.test.ts` refuse désormais qu'une action oublie son budget. |

### La leçon générale

**Un défaut invisible est pire qu'un défaut visible.** La moitié du travail de
ce dépôt consiste à transformer des pannes muettes en messages qui nomment la
cause et la correction. C'est le rôle de `src/instrumentation.ts` et d'une
douzaine de tests qui n'exercent pas du code mais **attachent une affirmation
publiée au code qui la rend vraie**.

---

## 6. Commandes

### Développement

```bash
npm install
npm run dev            # http://localhost:3000 — aucune variable requise
```

### Vérification — la séquence complète avant de pousser

```bash
npx tsc --noEmit                          # typage strict
npx next lint                             # ESLint
npx vitest run                            # 626 tests hermétiques
npm run build                             # 77 pages
npm audit                                 # doit rester à 0
node scripts/generer-import-sql.mjs --verifier
```

### Avec une vraie base — les 35 tests d'intégration

Ils sont **ignorés** sans `DATABASE_URL` (un clone doit pouvoir lancer les
tests sans installer de serveur), et exécutés en intégration continue.

```bash
# MariaDB local
sudo mariadbd-safe --skip-syslog &
sudo mysql -e "create database if not exists lunamarea_test;
               create user if not exists 'luna'@'localhost' identified by 'luna';
               grant all on lunamarea_test.* to 'luna'@'localhost';"

export DATABASE_URL='mysql://luna:luna@127.0.0.1:3306/lunamarea_test'
npm run migrate                           # applique 0001 puis 0002
npm run migrate                           # doit dire « schéma déjà à jour »
npx vitest run                            # 666 tests
```

### Le site complet en local, comptes compris

Il faut un serveur SMTP. Un capteur minimal suffit pour lire les liens de
connexion et les alertes.

```bash
NODE_ENV=production \
NEXT_PUBLIC_SITE_URL=http://localhost:3000 AUTH_URL=http://localhost:3000 \
AUTH_SECRET=un-secret-de-test-suffisamment-long \
DATABASE_URL='mysql://luna:luna@127.0.0.1:3306/lunamarea_dev' \
EMAIL_SERVER='smtp://boite@exemple.fr:motdepasse@127.0.0.1:2530' \
EMAIL_FROM='contact@lunamarea.fr' \
WEATHER_PROVIDER=mock TIDE_PROVIDER=mock \
UPLOADS_DIR=/tmp/luna-photos \
npm run build && npm start
```

### Scripts utiles

| Commande | Effet |
| --- | --- |
| `npm run migrate` | Applique les migrations non encore passées |
| `npm run import-sql` | Régénère `db/import-manuel.sql` (schéma en un fichier, pour phpMyAdmin) |
| `node scripts/verifier-exif.mjs` | Prouve le retrait des métadonnées d'une photo, dans Chromium |
| `npm start` | `prestart` migre la base avant de servir |

### Diagnostic en production

```bash
curl -s  https://lunamarea.fr/api/entretien   # sans-base | entretenu | echec
curl -s  https://lunamarea.fr/sitemap.xml | head -5
curl -sI https://lunamarea.fr/api/tuiles/8/127/88 | grep -i x-luna
```

---

## 7. Consignes de travail

Ces règles ont été posées par l'éditeur au fil du projet. Elles ne sont pas des
préférences de style : plusieurs sont adossées à des tests qui échouent si on
s'en écarte.

### Langue et forme

- **Tout est en français** : interface, contenu, commentaires, messages
  d'erreur, messages de commit, noms de variables du domaine métier.
- Les commentaires expliquent **pourquoi**, jamais **quoi**. Un commentaire qui
  paraphrase le code est du bruit ; un commentaire qui dit ce qu'on a essayé
  avant, et pourquoi ça ne marchait pas, vaut de l'or.

### Code

- **Next.js App Router, Server Components par défaut.** Un composant client se
  justifie ; il ne se subit pas. Il y en a 18, tous pour une raison nommée dans
  leur en-tête : un formulaire, une bascule de thème, un état de session que la
  page ne peut pas lire sans perdre son pré-rendu, ou la carte.
- **TypeScript strict.** Ni `any`, ni `@ts-ignore`. La seule concession est
  documentée à la frontière d'Auth.js.
- **Tout le code dans `src/`.**
- **Aucune couleur littérale** hors de `tokens.css`. Un test le vérifie ; la
  seule exception allouée est le gabarit de courriel, les clients de messagerie
  n'appliquant pas les variables CSS.
- **Zod à toutes les frontières**, et les schémas d'entrée sont **idempotents**.
- **`computeScore` reste pure.**
- **Le SQL vit uniquement** dans `src/lib/db/`, `src/lib/providers/mysql/` et
  `src/lib/auth/mysql-adapter.ts`. Paramètres toujours liés, jamais interpolés.

### Vérification

- **Vérifier dans un vrai navigateur**, pas seulement par des tests. Trois
  défauts majeurs de ce projet — le marqueur incliquable, la note sans motif,
  le formulaire réinitialisé — n'étaient visibles que par l'interaction réelle.
- **Un garde-fou doit être mis à l'épreuve** : on le casse volontairement pour
  vérifier qu'il tombe, puis on rétablit. Un test qui passe sans avoir jamais
  échoué ne prouve rien.
- **Rapporter honnêtement.** Si quelque chose n'a pas pu être vérifié, le dire —
  et dire comment le vérifier.

### Secrets

- **Aucun secret dans une conversation, un ticket ou le dépôt.** Ils vivent
  dans hPanel et dans GitHub Secrets. Une conversation se conserve, s'exporte
  et se recopie : un mot de passe qui y passe doit être considéré comme connu,
  donc changé.
- Le dépôt ne contient que **la mécanique qui s'en sert**.

### Git

- Développer et pousser sur **`claude/moonfish-mvp-web-t1l7st`**.
- **Ne pas créer de pull request** sans demande explicite.
- Messages de commit substantiels : ce qui change, **pourquoi**, ce qui a été
  vérifié, et les défauts trouvés en chemin.

---

## 8. Repères

| | |
| --- | --- |
| Dépôt | `nssbelhaj/Moonfish-web-app` — le nom du dépôt garde l'ancienne marque |
| Branche | `claude/moonfish-mvp-web-t1l7st` |
| Domaine cible | `lunamarea.fr` · contact `contact@lunamarea.fr` |
| Base de production | `u969082232_moonfish` — **le nom ne change pas** : Hostinger le fixe à la création |
| Hébergement | Hostinger Web Apps, déploiement GitHub automatique, Node ≥ 20.9 |
| Régime légal | Non professionnel (art. 6-III-2 LCEN) — adresse dispensée tant qu'aucune recette |
| Volume | 210 fichiers TS/TSX · ~26 600 lignes · 18 composants client · 666 tests · 154 URL au sitemap |

### Documents voisins

- **`README.md`** — la référence longue : comment remplacer les mocks, les
  garde-fous de palette, le détail du score, l'astronomie, et une critique
  finale honnête du projet.
- **`docs/deploiement-hostinger.md`** — pas-à-pas hPanel, variables, cron,
  contrôles après mise en ligne, comparaison Hostinger / Vercel.
- **`docs/mise-en-service-comptes.md`** — base, courriel, secrets, photos.
