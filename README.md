# Moonfish — MVP web

Score de pêche du bord sur 7 jours, spot par spot. Marée, vent, houle, périodes
solunaires et lumière, pondérés et expliqués.

État des données, à jour :

| Donnée | Source | Nature |
| --- | --- | --- |
| Vent, houle, températures, pression | Open-Meteo (modèles Marine & Forecast) | **Prévision réelle** |
| Marées et coefficients | Stormglass, *si `STORMGLASS_API_KEY` est définie* | **Prévision réelle** |
| Marées, sans clé | Modèle de démonstration Moonfish | **Simulé** |
| Soleil, Lune, périodes solunaires | Calcul local (NOAA + Meeus ELP-2000 abrégée) | **Calculé** |

Les avertissements de démonstration sont pilotés par la source réellement
utilisée : ils disparaissent d'eux-mêmes quand un fournisseur passe au réel, et
reviennent seuls s'il tombe. Il n'y a rien à retirer ni à remettre à la main.

---

## Installation

```bash
npm install
npm run dev      # http://localhost:3000
```

Node 20 ou plus. Aucune variable d'environnement n'est requise pour démarrer.

### Variables d'environnement

| Variable | Requise | Par défaut | Rôle |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | non | `https://moonfish.fish` | Base des URL canoniques, du sitemap et des balises Open Graph. Absente, le site fonctionne mais se désigne sous le domaine de repli. **Insérée à la compilation : la définir sans reconstruire ne change rien.** Le démarrage l'annonce. |
| `WEATHER_PROVIDER` | non | Open-Meteo | `mock` force les données simulées : build hors ligne, démonstration sans réseau, tests. |
| `OPEN_METEO_MARINE_URL` | non | API publique | Redirige vers une instance Open-Meteo auto-hébergée ou le stub local. |
| `OPEN_METEO_FORECAST_URL` | non | API publique | Idem pour le modèle atmosphérique. |
| `WAITLIST_FILE` | non | `var/waitlist.jsonl` | Chemin du fichier d'inscriptions, utilisé tant qu'aucune base n'est configurée. |
| `DATABASE_URL` | non | — | `mysql://…`. Ouvre les comptes, les contributions et la liste d'attente persistante. Absente, le site le dit et n'affiche aucun formulaire de connexion. Quatre variables `MYSQL_*` sont acceptées à la place : les hébergeurs ne s'accordent pas. |
| `EMAIL_SERVER` | avec les comptes | — | SMTP des liens de connexion. Le `@` de l'identifiant n'a rien à encoder ; `/`, `?`, `#` et `%` **dans le mot de passe**, si — sinon l'envoi part vers le mauvais hôte, sans erreur. |
| `EMAIL_FROM` | avec les comptes | — | Adresse d'expédition. |
| `AUTH_SECRET` | avec les comptes | — | Signe les jetons d'Auth.js. `openssl rand -base64 32`. |
| `AUTH_URL` | avec les comptes | — | Domaine public, pour construire les liens de connexion. |
| `UPLOADS_DIR` | avec les comptes | `var/uploads` | Photos de prises. **Hors du répertoire de l'application** : un déploiement le remplace et les photos disparaîtraient. Le code avertit au démarrage si le chemin est à l'intérieur. |
| `CRON_SECRET` | non | — | Ferme `/api/entretien` au public. Vercel l'envoie automatiquement à ses appels planifiés dès que la variable existe ; sur Hostinger, c'est la tâche cron qui porte l'en-tête. |

## Scripts

| Script | Effet |
| --- | --- |
| `npm run dev` | Serveur de développement |
| `npm run migrate` | Applique les migrations non encore passées à la base configurée |
| `npm run import-sql` | Régénère `db/import-manuel.sql` — le schéma en un fichier, pour phpMyAdmin |
| `node scripts/verifier-exif.mjs` | Prouve le retrait des métadonnées d'une photo, dans Chromium |
| `npm run build` | Build de production — 77 pages pré-rendues |
| `npm start` | Sert le build de production — `prestart` migre la base avant, tout seul |
| `npm run typecheck` | `tsc --noEmit` en mode strict renforcé |
| `npm run lint` | ESLint (config `next/core-web-vitals` + `next/typescript`) |
| `npm test` | 470 tests (Vitest). 453 hermétiques — aucun accès réseau ; les 17 d'intégration de la couche de données sont ignorés sans `DATABASE_URL`, et exécutés en intégration continue contre un vrai MySQL |
| `npm run test:watch` | Tests en mode surveillance |

---

## Arborescence

```
src/
├── app/                          Routes (App Router, Server Components par défaut)
│   ├── page.tsx                  Accueil — hero, recherche, 3 spots mis en avant, FAQ
│   ├── spots/
│   │   ├── page.tsx              Liste + filtres pilotés par searchParams
│   │   └── [country]/[region]/[slug]/
│   │       ├── layout.tsx        Coquille : sécurité, fil d'Ariane, titre, JSON-LD
│   │       ├── page.tsx          Onglet Live — score, graphique du jour, conditions
│   │       ├── prevision/        Onglet Prévision — 7 jours, meilleurs créneaux
│   │       ├── analyse/          Onglet Analyse — détail du calcul, techniques, accès
│   │       ├── especes/          Onglet Espèces — espèces connues du coin, mailles
│   │       ├── spot-page-data.ts Résolution partagée par le layout et les onglets
│   │       └── opengraph-image.tsx  Image OG dynamique, pré-rendue au build
│   ├── guides/                   Index + article ([slug])
│   ├── carte/                    Carte à tuiles interactive (+ repli SVG serveur)
│   ├── donnees/                  D'où viennent les données, bloc par bloc
│   ├── mentions-legales/         Éditeur, hébergeur, responsabilité
│   ├── confidentialite/          Traitements, stockage navigateur, droits
│   ├── compte/                   Connexion, profil, export, effacement
│   ├── api/auth/[...nextauth]/   Auth.js : lien de connexion, retour, sortie
│   ├── api/compte/               Photo, état de session, export JSON
│   ├── api/photos/[...chemin]/   Lecture des photos, hors répertoire d'app
│   ├── api/entretien/            Purge quotidienne des sessions périmées
│   ├── api/tuiles/[z]/[x]/[y]/   Relais des tuiles de carte — le navigateur ne joint aucun tiers
│   ├── api/waitlist/route.ts     POST — Zod + limiteur de débit + écriture
│   ├── sitemap.ts, robots.ts     Générés depuis les mêmes sources que les pages
│   ├── tokens.css                Variables CSS des deux thèmes ← POINT D'ENTRÉE DESIGN
│   ├── globals.css               Classes de composition (.surface, .frame, .pill…)
│   └── layout.tsx                Coquille, polices auto-hébergées, métadonnées de base
│
├── components/
│   ├── score/                    ScoreGauge, ScoreBadge, ScoreShape, ScoreReasons,
│   │                             ScoreBreakdown — les 4 canaux redondants du palier
│   ├── marine/                   TideChart, WindCompass, MoonPhase, FishGlyph
│   ├── spot/                     SpotCard, SpotResults, SafetyBanner
│   ├── v3/                       Pièces du handoff v3 : TideActivityChart,
│   │                             ScoreCartouche, ScoreScale, CompassMark,
│   │                             WaterValue, SlotTable, DayRuler, SpeciesCard,
│   │                             SpotsMap, SeaStateCard
│   ├── legal/                    LegalValue — une mention manquante s'affiche
│   ├── account/                  Connexion, profil, effacement de compte
│   ├── contributions/            Avis, prises, panneau de contribution
│   ├── data/                     DataSourceTag, DemoDataNotice ← honnêteté des données
│   ├── forms/                    EmailCaptureForm, SpotSearch, SpotFilters
│   ├── layout/                   SiteHeader, SiteFooter, ThemeToggle
│   │                             (ThemeToggle et les 3 formulaires sont les
│   │                             SEULS composants clients du projet)
│   ├── guides/, ui/
│
├── data/
│   ├── schemas.ts                Schémas Zod — la FRONTIÈRE avec les futures API
│   ├── spots.ts                  Les 12 spots (contenu éditorial réel)
│   ├── species.ts                Catalogue d'espèces : mailles, fonds, montages
│   ├── legal.ts                  Éditeur, régime LCEN, sous-traitants, stockages
│   └── generators/               Marée (onde M2) et conditions marines simulées
│
└── lib/
    ├── scoring/                  Le score. Pur, sans dépendance framework, testé
    │   ├── compute.ts            computeScore — l'agrégation pondérée
    │   ├── factors/              Un module par facteur : tide, wind, swell,
    │   │                         solunar, pressure, light
    │   ├── safety.ts             Règle de sécurité, JAMAIS dérivée du score
    │   ├── reasons.ts            Génération des 2–3 phrases explicatives
    │   └── math.ts               Trapèzes, rampes, formatage français
    ├── astro/                    Soleil (NOAA) et Lune — CALCULÉS, pas simulés
    │   ├── sun.ts                Lever, coucher, aube et crépuscule civils
    │   ├── moon-position.ts      Séries de Meeus 47.A/47.B : position lunaire
    │   └── moon.ts               Phase vraie, lever, coucher, méridiens
    ├── forecast/                 Assemblage providers → créneaux scorés
    │   ├── tide-context.ts       Contexte de marée reconstruit depuis les extremums
    │   ├── tide-curve.ts         Interpolation cosinusoïdale entre extremums
    │   ├── tide-coefficient.ts   Coefficient français, défini sur le marnage de Brest
    │   ├── wave-statistics.ts    Loi de Rayleigh : hauteur fréquente et maximale
    │   └── slots.ts              Découpage en 12 créneaux de 2 h, journée LOCALE
    ├── auth/                     Auth.js : configuration, adaptateur MySQL,
    │                             session, actions serveur
    ├── db/mysql.ts               LE seul module qui ouvre une connexion
    ├── photo/                    Retrait des métadonnées, stockage, URL
    ├── map/                      Projection équirectangulaire des spots
    ├── providers/                ← LE POINT DE BASCULE (voir plus bas)
    ├── guides.ts, markdown.ts    Chargement et rendu des articles
    ├── time.ts, geo.ts, routes.ts, random.ts, rate-limit.ts,
    └── score-display.ts, spot-filters.ts
```

---

## Comment remplacer les mocks par de vraies données

Un seul fichier à modifier : **`src/lib/providers/index.ts`**. Il exporte quatre
instances, une par interface. Aucune page, aucun composant, aucun module de
scoring n'importe une implémentation directement — tous passent par ces
exports. Le remplacement est donc une substitution, pas une réécriture.

```ts
// src/lib/providers/index.ts — état actuel
export const tides: TideProvider = new MockTideProvider();
export const weather: WeatherProvider = new MockWeatherProvider();
export const spots: SpotRepository = new MockSpotRepository();
export const waitlist: WaitlistRepository = new FileWaitlistRepository();
```

### 1. Marées → Stormglass ✅ FAIT

Implémenté dans `src/lib/providers/stormglass/tide.ts`. S'active dès que
`STORMGLASS_API_KEY` est définie ; sans elle, les marées restent simulées et le
site le dit — il ne casse pas.

**Deux appels par spot, et le second n'est pas une redondance.** Stormglass
donne des horaires et des hauteurs, jamais le coefficient français. Celui-ci est
*défini* par le SHOM comme le marnage de **Brest** rapporté à son unité de
hauteur :

```
coefficient = 100 × marnage_Brest / (2 × 3,05 m)
```

Le calculer sur le marnage local donnerait un nombre qui ne correspondrait à
aucune table de marée française — l'erreur qu'on trouve dans beaucoup
d'applications. L'appel Brest est identique pour les douze spots, donc mutualisé
par le cache : il coûte **un appel par jour au total**, pas douze.

Le coefficient ne dépend que d'une *différence* de hauteurs : il est donc
insensible au zéro de référence, ce qui le rend fiable même avec une source
étrangère. C'est vérifié par un test.

**Le quota, en clair.** L'offre gratuite de Stormglass est de 10 appels par
jour. Avec 12 spots + Brest, il faut 13 appels par cycle de cache :

| `TIDE_CACHE_SECONDS` | Appels/jour | Offre gratuite |
| --- | --- | --- |
| 86400 (24 h, défaut) | 13 | dépassée de 3 |
| 172800 (48 h) | 6,5 | tient |

Les prévisions de marée sont de l'astronomie : elles ne se réactualisent pas
d'heure en heure. Un cache de 48 h n'est pas un compromis, c'est une durée
juste — et c'est ce qui rend l'offre gratuite utilisable. Au-delà de 12 spots,
il faut passer à une offre payante ou à une autre source.

**Limites annoncées dans l'interface :** hauteurs rapportées au MLLW, proche du
zéro des cartes françaises sans lui être identique (écart possible de quelques
dizaines de centimètres). Le `DataSourceTag` renvoie vers le SHOM pour toute
sortie réelle.

**Tester sans clé ni réseau :** `node scripts/providers-stub.mjs 4000` sert des
réponses à la forme exacte de l'API, avec Brest calé sur son marnage réel pour
que les coefficients restent plausibles.

```bash
STORMGLASS_API_KEY=stub \
STORMGLASS_URL=http://127.0.0.1:4000/v2/tide/extremes/point \
npm run build
```

#### Ce que coûte Stormglass, mesuré

Stormglass est **ponctuel** : une requête par point, il n'existe pas de requête
groupée. Un spot = un appel, plus un appel Brest pour le coefficient national.

Les chiffres ci-dessous sont **mesurés**, pas estimés — `scripts/providers-stub.mjs`
compte les requêtes quand `STUB_LOG` est défini :

```bash
STUB_LOG=/tmp/calls.json node scripts/providers-stub.mjs 4000 &
STORMGLASS_API_KEY=stub STORMGLASS_URL=http://127.0.0.1:4000/v2/tide/extremes/point \
  npm run build
```

| Configuration | URL distinctes | Requêtes HTTP / build | Régime établi / jour |
| --- | --- | --- | --- |
| 12 spots | 13 | ~24 | 13 |
| 3 spots (`TIDE_REAL_SPOTS`) | 4 | 8 | 4 |

Deux choses expliquent ces nombres :

- **Le facteur 2 sur le build.** Les workers de `next build` ne partagent pas le
  cache de `fetch` : chaque URL est demandée environ deux fois. Ce n'est pas
  l'`AbortSignal` — mesuré, le retirer aggrave le compte.
- **13 par jour en régime établi.** La fenêtre demandée est calée sur le jour
  LOCAL du spot : l'URL change à minuit, donc le cache de 24 h expire une fois
  par jour quoi qu'on mette dans `TIDE_CACHE_SECONDS`. Allonger ce cache au-delà
  de 24 h ne change rien tant que la fenêtre n'est pas quantifiée sur plusieurs
  jours — c'est le levier à activer pour servir les 12 spots sur un petit quota.

**Sur le palier gratuit (10 appels/jour), utilisez `TIDE_REAL_SPOTS`** avec trois
spots. Les neuf autres restent en démonstration et l'annoncent : ils gardent leur
cadre pointillé et leur mention *Simulé*, sans allumer le voyant *Interrompu*,
réservé aux vraies coupures.

L'appel Brest est **mutualisé** : sa fenêtre est alignée sur la journée UTC
(`canonicalRange`) et non sur le jour local du spot, si bien que les douze spots
et les deux fuseaux du catalogue partagent une seule URL. Auparavant, France et
Maroc en produisaient deux — deux appels facturés pour un chiffre qui, par
définition, ne dépend que de l'instant.

### 2. Météo marine → Open-Meteo ✅ FAIT

Implémenté dans `src/lib/providers/open-meteo/weather.ts`. Deux modèles
distincts, appelés en parallèle et fusionnés **sur l'horodatage** (jamais sur
l'indice : rien ne garantit que les deux séries démarrent à la même heure) :

- `https://marine-api.open-meteo.com/v1/marine` → `wave_height`, `wave_period`,
  `wave_direction`, `sea_surface_temperature`
- `https://api.open-meteo.com/v1/forecast` → `wind_speed_10m`, `wind_gusts_10m`,
  `wind_direction_10m`, `temperature_2m`, `cloud_cover`, `pressure_msl`

Choix qui méritent d'être connus avant d'y toucher :

- `cell_selection=sea` — on veut la maille marine, pas la plus proche. Sur un
  spot de bord, la maille terrestre donne un vent freiné par le relief.
- `timeformat=unixtime` — supprime toute ambiguïté de fuseau à l'analyse.
- `wind_speed_unit=kmh` — le score raisonne en km/h ; ne pas s'en remettre au défaut.
- **Aucune clé d'API n'est nécessaire.** Open-Meteo est libre d'usage non
  commercial jusqu'à 10 000 appels par jour ; on en fait 24 par build.

Dégradation : `WeatherProviderWithFallback` rattrape toute panne et repasse la
source en `simulated`, ce qui **rallume** l'avertissement de démonstration. Un
mode dégradé qui se ferait passer pour un mode normal serait pire que la panne.

Robustesse : un champ d'affichage hors bornes physiques devient `null`
(« Indispo. ») ; seule une grandeur dont dépend le score fait écarter l'heure.
Une rafale aberrante ne doit pas coûter sept jours de vraie prévision.

Tester sans réseau : `node scripts/providers-stub.mjs 4000` sert des réponses
à la forme exacte de l'API, puis

```bash
OPEN_METEO_MARINE_URL=http://127.0.0.1:4000/v1/marine \
OPEN_METEO_FORECAST_URL=http://127.0.0.1:4000/v1/forecast \
npm run build
```

### 3. Spots → base de données

| | |
| --- | --- |
| **Interface** | `SpotRepository` |
| **À implémenter** | `list()`, `findBySlug()`, `findByPath()` |
| **Mock à remplacer** | `src/lib/providers/mock/spots.ts` |
| **Nouveau fichier** | `src/lib/providers/mysql/spots.ts` |
| **Ligne à changer** | `export const spots: SpotRepository = new MysqlSpotRepository()` |

Le schéma de la table découle directement de `spotSchema`
(`src/data/schemas.ts`). Conserver `slug`, `country_slug` et `region_slug` :
ce sont les clés d'URL, et les changer casserait l'indexation.

`generateStaticParams` du détail spot appelle `spots.list()` : le build ira donc
chercher les spots en base. Prévoir `export const revalidate` en conséquence.

### 4. Liste d'attente → MySQL ✅ FAIT

| | |
| --- | --- |
| **Interface** | `WaitlistRepository` |
| **Implémentation** | `src/lib/providers/mysql/waitlist.ts` |
| **Repli** | `src/lib/providers/mock/waitlist.ts` — fichier, éphémère, tant qu'aucune base n'est configurée |
| **Bascule** | automatique : `databaseEnabled()` dans `src/lib/providers/index.ts` |

Le route handler `src/app/api/waitlist/route.ts` n'a pas changé d'une ligne :
c'était l'objet de l'interface.

Deux détails imposés par le fait qu'AUCUN chemin de lecture n'existe sur cette
table — c'est ce qui empêche d'aspirer les adresses depuis l'application, et un
test échoue si un `select` y apparaît :

- une adresse déjà inscrite ne peut pas être détectée par une lecture préalable.
  C'est `insert ignore` qui la rejette, et le nombre de lignes affectées qui
  nous dit « déjà inscrite » ;
- `count()` rend `null` : ne pas avoir de chemin de lecture n'est pas la même
  chose que compter zéro.

**Reste à faire, et ce n'est pas cosmétique :** le limiteur de débit de
`src/lib/rate-limit.ts` est en mémoire de processus. Il ne protège rien dès
qu'il y a plusieurs instances ou du serverless — chaque instance a son propre
compteur. Le remplacer par un compteur partagé — une table MySQL avec une
fenêtre glissante suffirait, maintenant qu'une base est là.

### 5. Les avertissements de démonstration se retirent seuls

Rien à faire à la main. `DemoDataNotice` et la bordure pointillée `demo-frame`
sont pilotés par le `kind` des sources réellement utilisées : dès qu'un
fournisseur cesse de renvoyer `'simulated'`, l'avertissement correspondant
disparaît et `DataSourceTag` occupe le même emplacement, au même gabarit.

C'est déjà visible aujourd'hui : sur une page de spot, le bloc « Vent et état de
mer » est en bordure pleine et étiqueté *Prévision*, tandis que le bloc
« Marées du jour » garde son cadre pointillé et son étiquette *Simulé*.

### 6. La fraîcheur des données

Chaque `DataSourceTag` porte une puce à quatre états (R9, D13) :

| Puce | Quand | Couleur |
| --- | --- | --- |
| **À jour** | dans la fenêtre de validité de la source | `--accent-data` |
| **Ancien** | la fenêtre est dépassée sans renouvellement | `--warn` |
| **Interrompu** | le fournisseur réel a échoué, on sert un repli | `--danger` |
| **En attente** | on ignore de quand date la donnée | `--fg-faint` |

Trois décisions valent d'être connues avant d'y toucher :

- **La puce est un composant CLIENT** (`FreshnessChip`). Les pages de spot sont
  en ISR à `revalidate = 3600` : une fraîcheur calculée au rendu serait figée
  dans le HTML statique et dirait « à jour » sur une page vieille de cinquante-
  neuf minutes. Elle est donc recalculée dans le navigateur, contre l'horloge du
  lecteur, et rafraîchie chaque minute.
- **La date affichée vient du FOURNISSEUR**, pas du rendu. `ForecastSources`
  transporte un `SourceStatus { source, refreshedAt }` pour cette seule raison :
  auparavant l'interface montrait `generatedAt`, si bien qu'une table de marée
  sortie d'un cache de 24 h s'annonçait fraîche de la minute.
- **La validité est une propriété de la SOURCE**, via `SourceMeta.validityHours`,
  avec un défaut par `kind`. Marées et météo sont toutes deux des `forecast` et
  n'ont pourtant rien de commun : le vent est révisé plusieurs fois par jour, une
  table de marée est de l'astronomie prédite des mois à l'avance. Stormglass
  déclare donc 72 h, calées sur `MIN_COVERAGE_DAYS` — ce qui se dégrade dans une
  table cachée, ce n'est pas sa justesse, c'est sa couverture.

Un fournisseur simulé **délibérément configuré** (mode démo) n'est pas une panne
et n'allume pas « Interrompu » : seul un repli après échec porte
`SourceMeta.degraded`. Un voyant d'alerte permanent apprend à ne plus le
regarder.

La page **`/donnees`**, liée depuis le pied de page, détaille les sources, les
quatre états et ce que le produit ne sait pas faire.

Tests : `src/lib/__tests__/data-freshness.test.ts` et le bloc « les puces de
fraîcheur » de `src/lib/__tests__/contrast.test.ts`.

---

## Les créneaux, et la navigation par jour

### Un tableau plutôt qu'une jauge

Un créneau n'affichait que son heure, une barre et sa note. « 8,7 » sans motif
demande qu'on lui fasse confiance, alors que tout l'argument du site est de
montrer son calcul — et pour savoir POURQUOI, il fallait remonter au graphique
puis redescendre à une autre carte.

`SlotTable` porte les facteurs sur la ligne : note, état de la marée avec
l'écart à la pleine mer (« PM +2 h 30 »), vent et rafales avec le secteur,
houle et période, phase de lumière. Deux créneaux notés pareil ne se
ressemblent pas — l'un porté par une descendante, l'autre par une aube calme —
et c'est cette différence qui décide de la sortie.

L'ordre des colonnes est un choix : en téléphone le tableau défile
horizontalement, donc ce qui sort de l'écran en premier est ce dont on peut se
passer. Heure, note et marée restent visibles sans défiler.

### Sept jours en onglets, sans une ligne de JavaScript

La prévision empilait les sept jours. Avec un graphique et douze créneaux
chacun, atteindre samedi demandait six écrans de défilement — et une prévision
se consulte par comparaison, ce que l'empilement rendait pénible.

Un onglet réclame d'ordinaire un état, donc du JavaScript, donc une page
rendue côté client. Ici l'état est déjà dans l'URL : c'est le fragment.
`:target` le lit, et trois propriétés en découlent :

| | |
| --- | --- |
| **Zéro JavaScript ajouté** | la page reste entièrement pré-rendue — le site se consulte au bord de l'eau, en 4G faible |
| **Partageable** | `…/prevision#jour-2026-09-06` ouvre directement dimanche, ce qu'un état client ne permet pas |
| **Sans JavaScript** | fonctionne quand même |

Le masquage s'appuie sur `:has()`, faute de quoi CSS ne sait pas exprimer
« aucun jour n'est ciblé ». Un navigateur qui l'ignore affiche les sept jours
empilés — exactement le comportement précédent. La dégradation ramène à
l'ancienne page, jamais à une page cassée.

### Une durée annoncée qui ne correspondait pas au calcul

`SLOT_HOURS` vaut 2. Pourtant la page d'accueil, **sa balise de description —
celle que Google affiche** — et un guide annonçaient « un score par créneau de
trois heures » ; la page d'un spot parlait de « huit créneaux » là où il y en a
douze. L'écart datait d'un changement de granularité et personne ne l'avait vu,
faute d'écran montrant les horaires côte à côte.

`duree-creneau.test.ts` lit la constante et refuse toute phrase PUBLIÉE qui
associe un créneau à une autre durée. Les commentaires sont exclus du contrôle :
`slots.ts` explique légitimement pourquoi trois heures a été écarté, et
interdire la phrase là reviendrait à interdire d'expliquer la décision.

## La carte

Une carte à tuiles, un marqueur par spot portant son score, cliquable pour
ouvrir la fiche.

### Les tuiles passent par le serveur, et ce n'est pas un détail

Une carte ordinaire fait charger vingt à quarante images par le navigateur
depuis un tiers. Ce tiers reçoit alors l'adresse IP du visiteur, la zone qu'il
regarde — donc approximativement **où il pêche** — et la page d'origine.

`/confidentialite` affirme qu'aucune requête ne part du navigateur vers un
tiers. Brancher la carte en direct rendrait cette phrase fausse, et
`privacy-claims.test.ts` échouerait : c'est exactement son rôle.

`/api/tuiles/[z]/[x]/[y]` renverse la chose. Le navigateur ne parle qu'à notre
origine ; c'est le serveur qui va chercher la tuile. Mesuré dans un navigateur
pendant le chargement complet de la page : **un seul hôte joint, le nôtre.**

Trois conséquences, dont deux non évidentes :

| | |
| --- | --- |
| **Le fournisseur ne voit rien du visiteur** | il voit une poignée de requêtes venant d'une machine |
| **Une clé d'API resterait secrète** | une carte en direct l'exposerait dans le paquet du navigateur, lisible et dépensable par n'importe qui |
| **`TILE_URL` change de fournisseur sans toucher au code** | stub local pour vérifier hors ligne, service à clé le jour où la fréquentation dépasse ce que tolère la politique d'OpenStreetMap |

Les bornes de zoom (3 à 13) ne sont pas décoratives : sans elles la route
serait un proxy d'images ouvert, où n'importe qui ferait tirer à votre serveur
des tuiles du monde entier, à vos frais, derrière votre domaine. Les
coordonnées hors grille sont refusées avant d'aller déranger l'amont.

Quand l'amont ne répond pas, la route sert un pixel transparent plutôt qu'une
erreur : Leaflet afficherait sinon une mosaïque de cases cassées, ce qui
ressemble à un site en panne. La carte perd son décor, pas son information —
les positions et les scores ne viennent pas de l'amont.

### Un marqueur qu'on ne pouvait pas cliquer

Agadir et Taghazout sont à quinze kilomètres. À l'échelle où la France et le
Maroc tiennent sur le même écran, cela fait moins d'un marqueur d'écart, et
l'un **recouvrait l'autre entièrement**. Seule l'interaction réelle pouvait le
montrer : un clic sur Taghazout atterrissait sur Agadir.

L'écartement réutilise l'algorithme de la carte SVG — `separatePoints`, extrait
pour que les deux cartes ne divergent pas — recalculé à chaque zoom. Il
**disparaît** dès que les marqueurs cessent de se toucher : en s'approchant,
chacun revient exactement sur sa position. Un marqueur écarté porte un liseré
pointillé, parce qu'il n'est alors plus exactement là où il devrait être.

La première correction ne déplaçait que le DESSIN, par une transformation CSS.
Visuellement juste, et parfaitement inutile : Leaflet garde la zone cliquable
sur l'élément parent, resté en place. Le clic continuait d'atterrir au mauvais
endroit, mais l'écran ne le montrait plus — un défaut invisible est pire que le
défaut d'origine. C'est le marqueur lui-même qui bouge désormais.

### Ce que la carte coûte, et ce qu'elle ne coûte pas

C'est le seul écran interactif du site. Le coût est borné : Leaflet n'est
chargé que sur `/carte` — la page passe de 103 à 107 ko de JavaScript initial,
la bibliothèque arrivant ensuite dans un fragment séparé. Les marqueurs sont du
HTML, pas des images : zéro requête supplémentaire, là où Leaflet en ferait une
douzaine pour ses icônes par défaut.

Sans JavaScript, la carte dessinée au serveur prend le relais, et la liste des
spots — toujours présente sous la carte — reste le chemin le plus court au
clavier.

## Thèmes clair et nuit

Le thème CLAIR est le défaut. Le nuit s'obtient par `[data-theme="night"]` sur
`<html>`, posé par un script inline dans le `<head>` — pas à l'hydratation.
Sans ce script, la page peint d'abord le clair puis bascule : un flash blanc en
pleine nuit, sur une plage, exactement ce que D19 interdit.

Ordre de décision (D18) : le choix explicite mémorisé gagne s'il existe, sinon
on suit `prefers-color-scheme`. Mémorisé par appareil dans `localStorage`, la
clé est `moonfish-theme`.

La bascule porte TOUJOURS son libellé, jamais une icône seule : un soleil sans
mot ne dit pas s'il montre l'état courant ou l'action à déclencher. Elle est
absente des pages Guides (D16), qui restent en clair — lecture diurne et contenu
indexable.

Aucune transition sur la bascule (D19). C'est délibéré, pas un oubli.

### Une règle de palette que rien n'appliquait

`contrast.test.ts` établit depuis le v3 que seuls `fg` et `accent` tiennent AA
sur `surface-2`. Rien ne vérifiait la même chose du côté des COMPOSANTS : huit
éléments réels portaient `text-fg-muted` sur `bg-chip`, mesurés à 3,68:1 en
thème nuit sur la page rendue.

C'est le même angle mort que `text-abyss` en v2 — une règle vraie, écrite,
testée au bon endroit, et contournée à l'usage sans que rien ne la voie.
`color-classes.test.ts` interdit désormais toute encre non autorisée sur
`bg-surface-2`, et exige que plus aucun composant n'emploie les noms `chip` et
`card-2` du v2.

---

## Où toucher au design

**Handoff design v2.** Deux fichiers portent la totalité de la palette :

- **`src/app/tokens.css`** — littéraux et tokens sémantiques. Le sombre est le
  défaut (`:root`) ; `[data-theme="guide"]` habille les pages éditoriales.
- **`tailwind.config.ts`** — ne connaît que des noms sémantiques adossés à
  `var(--…)`, plus l'échelle typographique et les rayons.

Les composants n'utilisent que les tokens sémantiques (`bg-card`, `text-fg`,
`var(--score-best)`…), jamais les littéraux. Vérifié : **aucune couleur en dur
dans `src/components/` ni `src/app/`**.

### Les exceptions, et comment elles sont tenues

Deux endroits ne peuvent pas lire une variable CSS. La règle **D22** — aucune
couleur littérale hors des tokens — est vérifiée par un test qui fait échouer
le build, et ces exceptions sont elles-mêmes sous surveillance :

| Fichier | Raison | Garde-fou |
| --- | --- | --- |
| `src/lib/og-palette.ts` | L'image OG est rendue hors du DOM par Satori : pas de cascade, pas de variables. | `og-palette.test.ts` compare chaque valeur au littéral de `tokens.css`. |
| `src/lib/theme.ts` | `<meta name="theme-color">` est lue avant tout rendu, hors cascade. | Doit refléter `--page` du thème sombre. |

### Les quatre garde-fous de la palette

| Test | Ce qu'il empêche |
| --- | --- |
| `contrast.test.ts` | Une couleur sous 4,5:1. Lit `tokens.css`, ne recopie rien. |
| `color-classes.test.ts` | Une classe pointant vers une couleur retirée — Tailwind n'émet alors aucune règle, la classe devient un no-op **silencieux**. |
| `color-literals.test.ts` | Un `#rrggbb` dans un composant (D22). |
| `og-palette.test.ts` | La palette de l'image OG désynchronisée des tokens. |

---

## Comptes, contributions et RGPD

Trois choses que le site ne savait pas faire : ouvrir un compte, recueillir un
avis, enregistrer une prise. Elles arrivent ensemble parce qu'elles posent la
même question — que détenons-nous sur quelqu'un, et comment le lui rendre ou
l'effacer.

Tout tient chez un seul hébergeur : l'application, la base MySQL, les photos
sur disque, l'envoi des courriels. Aucun service tiers n'entre en jeu, et le
navigateur ne joint aucun domaine hors du nôtre.

### Ce qui les ouvre

Une base ET un envoi de courriel. Les deux, pas l'un ou l'autre : une base sans
courriel donnerait un formulaire de connexion qui n'envoie jamais rien, un
courriel sans base n'aurait nulle part où écrire la session.

Sans eux, le site **fonctionne entièrement** et annonce que les comptes ne sont
pas ouverts : ni formulaire qui échouerait, ni avis d'exemple pour meubler.
C'est la seule partie du projet sans mode démonstration, et c'est délibéré — une
marée simulée illustre un mécanisme, un faux avis serait un faux témoignage sur
la page qui promet précisément de rapporter ce que de vraies personnes ont
déclaré.

### La garantie perdue, et ce qui la remplace

La première version reposait sur PostgreSQL et sa sécurité au niveau des
lignes : le MOTEUR refusait une écriture au nom d'autrui, et un filtre oublié
dans le code ne pouvait pas provoquer de fuite. **MySQL n'a pas d'équivalent.**

C'est la seule chose que ce portage a coûtée, et elle mérite d'être nommée
plutôt que noyée. Trois mécanismes la remplacent :

| | Ce que ça empêche |
| --- | --- |
| Les signatures : `deleteReview(id, userId)` | Le compilateur refuse une suppression qui ne dit pas au nom de qui elle agit. |
| `src/lib/db/__tests__/proprietaire.test.ts` | Une modification sans `user_id = ?`, du SQL hors des modules autorisés, une valeur interpolée dans une requête, un `select` sur la liste d'attente. |
| Les tests d'intégration | Ils essaient réellement de supprimer le bien d'autrui, contre une vraie base, et vérifient que la ligne ET la photo sont intactes après le refus. |

C'est plus faible qu'une politique appliquée par le moteur : la garantie est
devenue conventionnelle. En contrepartie, **tout est vérifiable en local** — ce
que la version PostgreSQL ne permettait pas, faute de serveur joignable.

### Ce que les tests exercent réellement

```bash
DATABASE_URL=mysql://user:pass@127.0.0.1:3306/moonfish_test npm run test
```

Dix-sept tests d'intégration contre un vrai serveur, dont :

- **un pêcheur ne peut pas supprimer l'avis d'un autre** — le test central ;
- une suppression refusée ne touche pas non plus à la photo ;
- l'instant d'une prise survit à l'aller-retour sans dérive de fuseau. MySQL
  rend un `datetime` sans fuseau : une conversion négligée décalerait la prise
  de deux heures en été, donc de créneau de marée — l'erreur exacte que ce site
  existe pour éviter ;
- l'effacement d'un compte emporte profil, avis, prises et photos, et rien de
  ce qui appartient à quelqu'un d'autre ;
- une valeur hostile est traitée comme du texte, pas comme du SQL.

Sans `DATABASE_URL`, ils sont ignorés plutôt que rouges : un clone du dépôt doit
pouvoir lancer les tests sans installer de serveur.

### Un défaut que seule l'exécution pouvait révéler

Les schémas de saisie sont appliqués DEUX fois sur le même trajet : une fois
sur le formulaire, une fois à l'entrée du dépôt, qui ne fait confiance à
personne. Le premier passage transformait un commentaire vide en `null`, et le
second refusait `null`.

Conséquence en production : **tout avis sans commentaire et toute prise sans
mesure étaient rejetés** avec « saisie invalide ». Le défaut existait déjà dans
la version PostgreSQL et y a survécu entièrement — il ne se voyait qu'en
exécutant le trajet complet contre une vraie base. Les schémas sont désormais
idempotents, et trois tests le vérifient.

### Authentification

Un lien reçu par courriel, pas de mot de passe : ce que nous ne stockons pas ne
peut pas fuir. Aucun fournisseur externe non plus — « se connecter avec
Google » ferait savoir à Google que vous pêchez.

Auth.js gère le flux ; l'adaptateur MySQL est écrit à la main
(`src/lib/auth/mysql-adapter.ts`) plutôt que tiré d'un ORM, parce qu'il ne fait
que traduire une quinzaine d'appels en autant de requêtes de trois lignes.

Les sessions vivent **en base**, pas dans un jeton signé. Conséquence qui
compte : une déconnexion ou une suppression de compte prend effet
immédiatement, alors qu'un jeton auto-porté reste valable jusqu'à son
expiration — y compris après un « supprimez mes données ».

### Photos : les métadonnées ne partent jamais

Une photo de téléphone porte les coordonnées GPS de la prise de vue. Publier
une photo de bar sans y toucher, c'est publier la position d'un poste — ou,
si la photo a été prise en rentrant, celle d'un domicile.

Le nettoyage a lieu **dans le navigateur, avant l'envoi** : décodage,
réencodage dans un canevas, puis retrait des segments APP1–APP15 et des
commentaires. L'original ne quitte pas l'appareil, et le fichier part vers
notre serveur, pas vers un tiers.

`node scripts/verifier-exif.mjs` le prouve plutôt que de l'affirmer :

```
before: ["APP1","APP2"]   after: []   foundExifString: false
54 535 octets → 24 134,  2400×1800 → 1600×1200
```

Vérifié aussi **sur le fichier réellement stocké** après un parcours complet en
navigateur : aucun segment de métadonnées, aucune chaîne « Exif », rangé dans
le dossier de son auteur.

Les photos vivent HORS du répertoire de l'application (`UPLOADS_DIR`) : un
déploiement depuis Git remplace ce répertoire, et une photo écrite dedans
disparaîtrait à la mise en ligne suivante, sans erreur ni trace. Le code
avertit au démarrage en production si le chemin est à l'intérieur.

### Géolocalisation : nous ne la recevons pas

« Les spots près de moi » calcule les distances **dans le navigateur**, contre
la liste des spots qui est déjà publique. Aucun point d'accès du serveur ne sait
recevoir une position — c'est plus solide qu'une promesse de ne pas s'en servir.
La demande d'autorisation part d'un clic, jamais du chargement de la page.

### Droits, et ce qu'ils coûtent en clics

| Droit | Comment |
| --- | --- |
| Accès et portabilité | `/compte` → un fichier JSON complet, immédiat, sans demande |
| Effacement | `/compte` → suppression du compte, des avis, des prises et des photos |
| Rectification | modification d'un avis, renommage du profil |
| Retrait du consentement | la suppression du compte l'emporte |

L'effacement repose sur la cascade du schéma : c'est la base qui garantit qu'il
ne reste rien, pas une suite d'appels qu'on pourrait oublier. Les photos, non
liées par une clé étrangère, sont supprimées explicitement juste avant.

**Un défaut trouvé en conditions réelles, et corrigé.** À la première
vérification, le compte était bien supprimé et la base vide — mais l'avis
restait AFFICHÉ jusqu'à une heure sur la page du spot, qui est pré-rendue. Un
effacement qui se voit encore n'est pas un effacement, et c'est la seule partie
du droit à l'oubli que l'utilisateur constate. Les spots concernés sont
désormais relevés avant la suppression, et leurs pages rafraîchies après.

### Un rendu statique préservé

La page des espèces reste pré-rendue et mise en cache une heure, comptes
ouverts ou non. Lire une session veut dire lire les cookies, et lire les
cookies bascule toute la route en rendu dynamique dans Next. Les avis et les
prises sont donc lus **sans session** — ils sont publics et identiques pour
tous — et chaque écriture révalide le chemin du spot. Seule la zone
« contribuer » résout la session côté navigateur, par un appel à
`/api/compte/etat`, et apparaît après l'hydratation.

Compromis explicite : ce qui doit être lisible sans JavaScript et indexable, ce
sont les listes, pas les formulaires.

### Mise en service

Le pas-à-pas est dans **`docs/mise-en-service-comptes.md`** : base, migration,
SMTP, secrets, tâche d'entretien, et le parcours à refaire à la main.

Deux pièges qui ne se voient pas :

- dans `EMAIL_SERVER`, un `/`, `?`, `#` ou `%` **du mot de passe** doit être
  encodé (`%2F`, `%3F`, `%23`, `%25`). Sinon l'URL est tronquée et l'envoi part
  vers un autre hôte avec un mot de passe vide, **sans lever d'erreur**. Le `@`
  de l'identifiant, lui, n'a rien à encoder — ce dépôt a longtemps affirmé le
  contraire ;
- `UPLOADS_DIR` doit sortir du répertoire de l'application, sous peine de
  perdre les photos au déploiement suivant.

### Ce qui a été exercé, et ce qui reste à voir

Le parcours COMPLET a été joué dans un vrai navigateur, contre une vraie base
MariaDB et un vrai serveur SMTP : demande de lien, réception du courriel,
échange du jeton, création du profil, publication d'un avis, déclaration d'une
prise avec photo, affichage pour un visiteur anonyme, export JSON, suppression
du compte, disparition immédiate de la contribution.

Reste à voir en production, et personne ne peut le simuler : que les courriels
**arrivent** — SPF, DKIM et réputation du domaine ne se testent pas en local.
C'est le premier point à vérifier après la mise en ligne.


## Le Soleil et la Lune

Les deux sont calculés dans `src/lib/astro`, sans réseau, sans clé et sans
cache : rien à brancher, rien qui puisse tomber.

**Soleil** — algorithme NOAA. Lever, coucher, aube et crépuscule civils, à la
minute.

**Lune** — séries périodiques de Meeus (*Astronomical Algorithms*, tables 47.A
et 47.B : l'abrégé de la théorie ELP-2000/82). Le module donne la position, et
`moon.ts` en tire :

- la **phase vraie**, par l'élongation Soleil–Lune, et non par un compteur de
  jours depuis une nouvelle lune de référence. Les lunaisons réelles vont de
  29,25 à 29,71 jours ; un modèle à période constante se trompe jusqu'à
  quatorze heures sur la date d'une pleine lune ;
- le **lever et le coucher**, cherchés par balayage de la hauteur puis
  dichotomie à la seconde, avec parallaxe et réfraction. Ils dépendent de la
  latitude — l'ancien modèle les posait à ±6 h 12 du passage au méridien, ce
  qui n'est exact qu'à l'équateur et à l'équinoxe ;
- les **passages au méridien**, supérieur et inférieur, qui sont les périodes
  solunaires majeures.

Un lever peut valoir `null` : la Lune se lève environ cinquante minutes plus
tard chaque jour et saute donc une journée civile deux fois par mois. Ce n'est
pas une panne, et l'interface écrit « pas de lever » plutôt qu'un tiret.

### Comment on sait que les tables sont justes

Cent vingt lignes de coefficients recopiées à la main ne se vérifient pas en les
relisant. `moon-position.test.ts` rejoue **l'exemple 47.a de Meeus** (12 avril
1992), dont les résultats sont publiés au millionième de degré :

| | Calculé | Publié |
| --- | --- | --- |
| Longitude λ | 133,162655° | 133,162655° |
| Latitude β | −3,229126° | −3,229126° |
| Distance Δ | 368 409,7 km | 368 409,7 km |
| Parallaxe π | 0,991990° | 0,991990° |

Le temps sidéral est vérifié de la même façon sur l'exemple 12.a. Et la période
synodique est mesurée **sur dix-neuf ans** — pas sur une année, où la moyenne
des lunaisons ne vaut pas 29,53 j et où un test naïf échouerait à raison.

En contre-épreuve, les horaires ont été comparés à une série lunaire
indépendante et beaucoup plus grossière : l'écart va de 0 à 10 minutes, sans
biais systématique, ce qui est exactement l'erreur propre de cette série-là.

### Ce que ça coûte

Chercher un lever demande une centaine d'évaluations des séries. Sur un build
complet — douze spots, sept jours, cinq pages par spot — c'est environ
**1,7 seconde**, après trois optimisations qui ont divisé le surcoût par trois :
une seule évaluation des séries par échantillon au lieu de trois, la phase
calculée une fois par créneau au lieu de deux, et une mémoïsation par journée
(fonction pure, clé complète : un souvenir de calcul, pas un cache de données).

## Le score

`computeScore(input: ScoreInput): ScoreResult` dans `src/lib/scoring/`.
Fonction pure : aucun accès réseau, aucune horloge, aucun système de fichiers.

| Facteur | Poids | Optimal |
| --- | --- | --- |
| Marée | 32 % | −2 h à +1 h autour de la pleine mer, ou descendante établie. Coefficient 70–95. Étale pénalisée. |
| Vent | 23 % | 10–25 km/h de secteur mer. Vent de terre modéré = correct. > 40 km/h = mauvais. |
| Houle | 18 % | 0,5–1,5 m. < 0,3 m trop calme, > 2,5 m mauvais. |
| Solunaire & lune | 13 % | Périodes majeures (zénith/nadir) et mineures (lever/coucher), bonus vive-eau. |
| Pression | 9 % | Baisse douce (−0,5 à −2,5 hPa/3 h). Chute brutale et hausse franche pénalisées. |
| Lumière | 5 % | Aube, crépuscule, nuit devant le plein jour. |

**La pression compte par sa TENDANCE, pas par sa valeur.** 1013 hPa n'est ni bon
ni mauvais ; c'est la variation sur trois heures qui porte l'information. Une
baisse douce précède souvent une phase active, une hausse franche derrière un
front la referme. Une chute brutale n'est pas récompensée : elle annonce du gros
temps, et la récompenser ferait monter le score juste avant un coup de vent.
Sans tendance calculable — au début de la série — le facteur se neutralise à 5
et le dit, plutôt que d'inventer une direction.

**Les hauteurs de vagues sont dérivées, pas mesurées.** Seule la hauteur
significative vient du modèle. La plus fréquente (Hs/2) et la maximale attendue
(Hs·√(ln N / 2)) sortent de la loi de Rayleigh — `src/lib/forecast/wave-statistics.ts`.
Le contrôle est dans les tests : la formule doit retrouver « 14 % des vagues
dépassent la significative » et « le double, trois fois par jour à 9 s de
période ». Ce sont les deux nombres publiés partout ; s'ils ne tombaient pas,
nous afficherions une statistique inventée sous couvert d'océanographie.

**Règle non négociable.** Si houle > 2,5 m **ou** vent > 50 km/h,
`safety.level` vaut `'danger'` et l'interface affiche un bandeau non refermable
au-dessus du score, quel que soit le score calculé. Cette évaluation vit dans
`src/lib/scoring/safety.ts` et n'est jamais dérivée du `breakdown` : c'est
volontaire, pour qu'aucune modification des pondérations ne puisse l'affaiblir.

### Quand une source manque

Un fournisseur peut tomber. Le score ne doit alors ni disparaître, ni mentir.

- Le facteur concerné sort du calcul avec `score: null`. **Jamais 0** : un zéro
  se comporterait comme une mauvaise note et affirmerait une condition qu'on n'a
  pas mesurée. **Jamais une valeur par défaut** non plus, pour la même raison.
- Les poids des facteurs restants sont **renormalisés** : leur somme reste 1, le
  total reste sur 10 et reste comparable d'un créneau à l'autre.
- `coverage` dit quelle part du poids nominal a réellement été couverte, et une
  raison le dit en français : « Calculé sans la houle : source indisponible. »
  Elle est placée **avant** les arguments, jamais après.
- Le détail (`ScoreBreakdown`) garde la ligne du facteur absent, avec « —,— » et
  « écarté du calcul (pesait 20 %) ». Les autres lignes affichent leur poids
  renormalisé à côté du poids nominal — c'est le renormalisé qui explique le
  total affiché.
- Si **aucun** facteur n'est disponible, `value` et `label` valent `null` et la
  jauge affiche « —,— / Indispo. » avec une seule raison : « Prévision
  indisponible pour ce créneau. »
- La sécurité ne présume rien : **sans mesure de houle ou de vent, le verdict ne
  peut pas être `'ok'`.** Il passe à `'prudence'` et dit que les seuils de 2,5 m
  et 50 km/h n'ont pas pu être vérifiés. L'absence de donnée n'est pas une
  preuve de mer praticable.
- Un créneau sans marée ou sans météo **reste affiché**. Le supprimer ferait
  disparaître trois heures de la journée sans rien expliquer : une panne
  ressemblerait à un trou naturel dans les données.

Tests : `src/lib/scoring/__tests__/missing-sources.test.ts` et le bloc
« panne du fournisseur » de `src/lib/forecast/__tests__/forecast.test.ts`.

---

## Déterminisme

Aucun `Math.random()` dans le projet. Les conditions simulées sont produites par
un générateur seedé sur le slug du spot (`src/lib/random.ts`), et l'instant de
référence est arrondi à l'heure (`referenceNow()`). Deux builds lancés dans la
même heure produisent des pages strictement identiques.

## Qualité mesurée

Lighthouse, build de production :

| | Performance | Accessibilité | SEO | Bonnes pratiques |
| --- | --- | --- | --- | --- |
| Mobile, toutes les pages | 96–99 | 100 | 100 | 100 |
| Bureau, pages légales | 100 | 100 | 100 | 100 |

Contraste vérifié sur le DOM rendu, pas seulement sur les tokens : zéro élément
sous le seuil AA sur les deux pages légales, dans les deux thèmes, à 390 et
1440 px.

`npm run build`, `npm run typecheck` et `npm run lint` passent sans erreur ni
avertissement. 407 tests, dont 17 d'intégration contre une vraie base. Aucun débordement horizontal à 375 px.

## Pages légales

`/mentions-legales` et `/confidentialite` existent et sont liées depuis le pied
de page de toutes les pages. Leur contenu est exact pour ce que le site fait
aujourd'hui : une seule donnée personnelle collectée (l'adresse e-mail de la
liste d'attente), aucun compte, aucune mesure d'audience, aucun cookie.

`PUBLISHER` dans `src/data/legal.ts` porte l'identité de l'éditeur. Nom,
contact et directeur de la publication sont renseignés. **Il reste l'adresse
postale**, et le choix qu'elle suppose.

L'article 6-III de la LCEN ne demande pas la même chose selon qui édite, et
`PUBLICATION_REGIME` exprime cette différence :

| Régime | Adresse | Quand il s'applique |
| --- | --- | --- |
| `professionnel` | **publiée** | dès qu'il y a une recette : publicité, paiement, partenariat rémunéré. Les dons ne comptent pas. |
| `non-professionnel` **← actif** | **dispensée** | un particulier peut ne publier que le nom de l'hébergeur, à condition que celui-ci détienne son identité — ce qu'un contrat d'hébergement suffit à établir. |

Moonfish est sur le second : il n'affiche ni publicité ni paiement.

**Ce réglage se périme, et c'est son danger.** Il devient faux — et s'en
prévaloir devient une infraction — le jour où le site encaisse quoi que ce
soit. Or ce jour-là, on pense à faire marcher le paiement, pas aux mentions
légales. `regime-publication.test.ts` échoue donc si le régime vaut encore
`non-professionnel` alors qu'apparaît soit une dépendance de paiement ou de
régie, soit un lien d'affiliation ou de don écrit à la main dans `src/`
(`buymeacoffee.com`, `amzn.to`, `paypal.me`…). La bascule est attachée à un
fait vérifiable plutôt qu'au souvenir qu'on en a, et le message rappelle les
TROIS conséquences simultanées : l'adresse redevient obligatoire, la relation
commerciale doit être divulguée, et la page de confidentialité — qui affirme
aujourd'hui ne poser aucun cookie ni joindre aucun tiers — devient fausse dès
que le lien en dépose un.

Sous le régime non professionnel, l'absence d'adresse est **expliquée** sur la
page, pas tue : la dispense n'est acquise que si l'on dit qui héberge et que
l'identité lui a été communiquée. Taire l'adresse sans le dire ne serait pas
une dispense, seulement une omission.

Tant qu'une mention obligatoire vaut `null`, les deux pages affichent un
bandeau qui dit qu'elles sont incomplètes, et chaque champ manquant s'affiche
comme tel plutôt que de laisser un blanc qui aurait l'air conforme. Le bandeau
disparaît tout seul une fois le nécessaire renseigné : rien à penser à retirer.
`src/lib/__tests__/regime-publication.test.ts` fixe les deux régimes et vérifie
que la page LIT l'identité au lieu de la recopier.

Le même fichier tient la liste des sous-traitants (`PROCESSORS`) et celle de ce
que le site écrit dans le navigateur (`CLIENT_STORAGE` — aujourd'hui la seule
préférence de thème). Les pages LISENT ces listes ; elles ne les recopient pas.

`src/lib/__tests__/privacy-claims.test.ts` attache les affirmations de la page
au code qui les rend vraies, parce qu'une politique de confidentialité se périme
d'ordinaire par simple oubli :

| Affirmation de la page | Ce qui la vérifie |
| --- | --- |
| « aucun cookie, un seul stockage » | Compte les points d'écriture (`localStorage`, `sessionStorage`, `document.cookie`, `cookies().set`) dans `src/` et exige l'égalité avec `CLIENT_STORAGE`. |
| « aucune requête vers un tiers depuis votre navigateur » | Interdit tout `src="http…"`, `@import`, `url(http…)` et tout `fetch` client vers un domaine extérieur. |
| « nous ne journalisons pas votre adresse » | Refuse un `console.*` contenant l'e-mail d'une inscription dans le dépôt de liste d'attente. |
| Pages atteignables | Exige les deux routes dans le pied de page et dans le sitemap. |

Ces quatre tests ont été vérifiés en état d'échec avant d'être conservés : un
stockage ajouté, un `fetch` vers un domaine extérieur et un e-mail journalisé
les font tomber chacun sur son propre message.

Trois règles sont déjà écrites sur la page pour les fonctions à venir, afin
qu'on puisse nous les opposer : la position de l'appareil ne remontera pas au
serveur, les photos de prises seront débarrassées de leurs métadonnées EXIF
avant enregistrement, et toute mesure d'audience sera sans identifiant ou
soumise à un consentement préalable.

## Déploiement

Aucune base de données n'est nécessaire à ce stade, et Open-Meteo ne demande pas
de clé. Sur Vercel : importer le dépôt et déployer. **Aucune variable
d'environnement n'est requise** — sans `NEXT_PUBLIC_SITE_URL`, les URL
canoniques sont déduites du domaine que Vercel injecte lui-même.

Ailleurs que sur Vercel, cette déduction n'existe pas : `NEXT_PUBLIC_SITE_URL`
devient obligatoire, sans quoi le sitemap et les balises de partage désignent le
domaine de repli. Le pas-à-pas pour Hostinger — création de la Web App, variables,
tâche planifiée, contrôles après mise en ligne — est dans
**`docs/deploiement-hostinger.md`**, qui compare aussi les deux hébergements.

Un point à connaître : le plan **Hobby de Vercel interdit l'usage commercial**.
Publicité ou paiement imposent le plan Pro. Moonfish n'a ni l'un ni l'autre, et
les dons ne comptent pas, mais la question se posera le jour de la monétisation.

Node 20.9 ou plus est exigé via `engines`. Un projet Vercel resté sur Node 18
échoue avant même la compilation ; ce champ force le bon choix.

Sans base configurée, les inscriptions à la liste d'attente atterrissent dans le
répertoire temporaire de l'instance et **n'y survivent pas** — acceptable pour
une démonstration, pas pour une collecte réelle. Avec `DATABASE_URL`, elles
passent en base et le repli n'est plus utilisé.

### Ce qui est automatique, et où vivent les secrets

Une question revient, et elle mérite une réponse nette : **faut-il confier des
identifiants d'hébergement pour que la mise en ligne et la base se tiennent à
jour toutes seules ?** Non. Aucun secret n'a à passer par une conversation, un
ticket ou un fichier du dépôt. Une conversation se conserve, se recopie et
s'exporte ; un mot de passe qui y est passé doit être considéré comme connu, et
il faut le changer. La bonne architecture est l'inverse : **les secrets vivent
chez la plateforme, et le dépôt contient la mécanique qui s'en sert.**

Concrètement, trois endroits et un seul geste manuel :

| Où | Quoi | Qui le fait |
| --- | --- | --- |
| hPanel → Web App → Variables | `DATABASE_URL`, `EMAIL_SERVER`, `AUTH_SECRET`, `UPLOADS_DIR`… | vous, une fois |
| GitHub → *Settings → Secrets* | rien d'obligatoire aujourd'hui : l'intégration lit le dépôt public | vous, si un jour un déploiement sortant en a besoin |
| Le dépôt | le code, les migrations, les contrôles | ici |

Ensuite, plus rien à faire à la main :

1. **le code** part à chaque poussée sur la branche connectée — Hostinger
   reconstruit tout seul, comme Vercel ;
2. **le schéma** suit le code. `prestart` lance
   `node scripts/migrer-mysql.mjs --au-demarrage` juste avant `next start` :
   les migrations non encore appliquées passent, les autres non ;
3. **les contrôles** tournent avant, dans `.github/workflows/verification.yml` :
   typage, lint, migrations **contre une vraie base MySQL**, tests, build.

#### Pourquoi les migrations ont un registre

Le script tenait une trace de rien : il rejouait tous les fichiers à chaque
démarrage. Cela marchait tant que tout était en `create table if not exists` —
et la première migration qui ajoute une colonne aurait échoué au deuxième
passage, **en pleine mise en ligne**. La table `schema_migrations` garde
maintenant le nom de chaque fichier appliqué et son empreinte SHA-256.

L'empreinte n'est pas décorative. Modifier une migration déjà passée est la
façon la plus discrète de faire diverger deux environnements : la base garde
l'ancienne forme, le dépôt affiche la nouvelle, et plus personne ne sait
laquelle fait foi. Le script refuse, s'arrête, et dit de créer une nouvelle
migration à la place.

#### Une politique d'échec qui n'est pas la même partout

Elle est délibérément asymétrique, parce que les conséquences ne sont pas
symétriques :

| Situation | Au démarrage | En manuel |
| --- | --- | --- |
| Aucune base configurée | on passe, sans bruit — le site sans comptes est un mode prévu | erreur : on a demandé une migration |
| Base injoignable | **avertissement, et on démarre quand même** | erreur |
| Une migration échoue | **arrêt** — le déploiement échoue, la version précédente reste en ligne | erreur |

La deuxième ligne est celle qui compte. Marées, météo, guides et score ne
touchent pas la base : refuser de démarrer parce que MySQL a hoqueté ferait
tomber tout le site pour protéger la seule partie qui en dépend. Les comptes
restent fermés le temps que la base revienne, et le site le dit.

La troisième aussi, dans l'autre sens : faire tourner du code contre un schéma
à moitié migré corrompt des données en silence. Mieux vaut un déploiement qui
échoue bruyamment.

#### Ce que le workflow d'intégration vérifie vraiment

Il applique les migrations sur une base MySQL 8 jetable, **puis les applique une
seconde fois** et exige que le second passage ne fasse rien. C'est le seul moyen
de démontrer l'idempotence avant qu'un déploiement ne la mette à l'épreuve.

Les tests d'intégration de la couche de données s'exécutent alors pour de vrai :
en local ils sont ignorés faute de `DATABASE_URL`, et c'est là qu'ils sont le
plus utiles, puisqu'ils vérifient qu'un utilisateur ne peut pas supprimer l'avis
d'un autre.

### Les `overrides`, et pourquoi ils sont là

`package.json` force trois versions transitives. Ce n'est pas une commodité :
`npm audit` remontait 7 vulnérabilités, dont une critique et cinq hautes, et
proposait Next 16 — une version MAJEURE — comme correctif.

En lisant la chaîne `via`, il n'y avait que **trois causes réelles** :

| Cause | Entrées qu'elle produisait | Où elle vit |
| --- | --- | --- |
| `nodemailer` | `nodemailer`, `@auth/core`, `next-auth` | envoi des liens de connexion |
| `postcss` | `postcss`, `next` | compilation des styles |
| `sharp` | `sharp` | optimisation des images |

Les corriger à la racine ramène le compte à **zéro sans quitter Next 15**. Le
« correctif » que npm proposait pour `next-auth` était d'ailleurs un RETOUR à
la v1 — une autre génération de la bibliothèque, pas une mise à jour.

`nodemailer` passe de 8 à 9, une majeure, imposée à `@auth/core` qui ne l'a pas
demandée. Un `overrides` ment à une dépendance sur ce qu'elle reçoit : la seule
façon honnête de le poser est de vérifier la chaîne entière, ce qui a été fait
contre un serveur SMTP réel — demande de lien, courriel reçu, lien ouvert,
session créée en base, `/api/compte/etat` répondant `signedIn: true`.

**Ce qui reste sciemment non corrigé** : rien. Mais l'avis `postcss` touchait
aussi la copie embarquée par Next, et l'`override` la remplace — à surveiller
lors d'une montée de version de Next, où le forçage pourrait devenir un frein
plutôt qu'un correctif.

### Si le build échoue

| Symptôme dans le log | Cause | État |
| --- | --- | --- |
| `Failed to collect page data` + `TypeError: Invalid URL` | `NEXT_PUBLIC_SITE_URL` sans `https://`. Le message ne nomme jamais la variable. | Corrigé : la valeur est normalisée, jamais passée telle quelle à `new URL()`. |
| Build qui reste bloqué puis est tué | Un appel Open-Meteo qui ne répond pas, sans refuser la connexion. | Corrigé : délai maximal de 8 s par appel, puis repli sur les données simulées. |
| `Node.js Version 18.x is deprecated` | Projet Vercel réglé sur une version retirée. | Corrigé : `engines.node` impose ≥ 20.9. |
| `npm ci` échoue | `package-lock.json` désynchronisé. | Vérifié : `npm ci` passe sur un clone propre. |

En dernier recours, `WEATHER_PROVIDER=mock` construit le site sans aucun appel
réseau — utile pour isoler un problème de build d'un problème de fournisseur.
