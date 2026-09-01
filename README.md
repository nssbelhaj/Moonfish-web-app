# Moonfish — MVP web

Score de pêche du bord sur 7 jours, spot par spot. Marée, vent, houle, périodes
solunaires et lumière, pondérés et expliqués.

État des données, à jour :

| Donnée | Source | Nature |
| --- | --- | --- |
| Vent, houle, températures, pression | Open-Meteo (modèles Marine & Forecast) | **Prévision réelle** |
| Marées et coefficients | Stormglass, *si `STORMGLASS_API_KEY` est définie* | **Prévision réelle** |
| Marées, sans clé | Modèle de démonstration Moonfish | **Simulé** |
| Lever/coucher du Soleil, phase de Lune | Calcul local (NOAA + lunaison) | **Calculé** |

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
| `NEXT_PUBLIC_SITE_URL` | non | `https://moonfish.fish` | Base des URL canoniques, du sitemap et des balises Open Graph. À définir avant toute mise en ligne. |
| `WEATHER_PROVIDER` | non | Open-Meteo | `mock` force les données simulées : build hors ligne, démonstration sans réseau, tests. |
| `OPEN_METEO_MARINE_URL` | non | API publique | Redirige vers une instance Open-Meteo auto-hébergée ou le stub local. |
| `OPEN_METEO_FORECAST_URL` | non | API publique | Idem pour le modèle atmosphérique. |
| `WAITLIST_FILE` | non | `var/waitlist.jsonl` | Chemin du fichier d'inscriptions. Bascule automatiquement dans le répertoire temporaire sur Vercel. |

## Scripts

| Script | Effet |
| --- | --- |
| `npm run dev` | Serveur de développement |
| `npm run build` | Build de production — 38 pages statiques |
| `npm start` | Sert le build de production |
| `npm run typecheck` | `tsc --noEmit` en mode strict renforcé |
| `npm run lint` | ESLint (config `next/core-web-vitals` + `next/typescript`) |
| `npm test` | 195 tests unitaires (Vitest), hermétiques — aucun accès réseau |
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
│   │       ├── spot-page-data.ts Résolution partagée par le layout et les onglets
│   │       └── opengraph-image.tsx  Image OG dynamique, pré-rendue au build
│   ├── guides/                   Index + article ([slug])
│   ├── api/waitlist/route.ts     POST — Zod + limiteur de débit + écriture
│   ├── sitemap.ts, robots.ts     Générés depuis les mêmes sources que les pages
│   ├── globals.css               Variables CSS des deux thèmes ← POINT D'ENTRÉE DESIGN
│   └── layout.tsx                Coquille, polices auto-hébergées, métadonnées de base
│
├── components/
│   ├── score/                    ScoreGauge, ScoreBadge, ScoreShape, ScoreReasons,
│   │                             ScoreBreakdown — les 4 canaux redondants du palier
│   ├── marine/                   DayActivityChart (marée + score + créneaux),
│   │                             TideChart, WindCompass, MoonPhase, TimeWindowBar,
│   │                             FishGlyph
│   ├── spot/                     SpotCard, SpotResults, SafetyBanner
│   ├── data/                     DataSourceTag, DemoDataNotice ← honnêteté des données
│   ├── forms/                    EmailCaptureForm, SpotSearch, SpotFilters (les 3
│   │                             SEULS composants clients du projet)
│   ├── guides/, layout/, ui/
│
├── data/
│   ├── schemas.ts                Schémas Zod — la FRONTIÈRE avec les futures API
│   ├── spots.ts                  Les 12 spots (contenu éditorial réel)
│   └── generators/               Marée (onde M2) et conditions marines simulées
│
└── lib/
    ├── scoring/                  Le score. Pur, sans dépendance framework, testé
    │   ├── compute.ts            computeScore — l'agrégation pondérée
    │   ├── factors/              Un module par facteur : tide, wind, swell,
    │   │                         solunar, light
    │   ├── safety.ts             Règle de sécurité, JAMAIS dérivée du score
    │   ├── reasons.ts            Génération des 2–3 phrases explicatives
    │   └── math.ts               Trapèzes, rampes, formatage français
    ├── astro/                    Soleil (NOAA) et Lune — CALCULÉS, pas simulés
    ├── forecast/                 Assemblage providers → créneaux scorés
    │   ├── tide-context.ts       Contexte de marée reconstruit depuis les extremums
    │   ├── tide-curve.ts         Interpolation cosinusoïdale entre extremums
    │   ├── tide-coefficient.ts   Coefficient français, défini sur le marnage de Brest
    │   └── slots.ts              Découpage en 8 créneaux de 3 h, journée LOCALE
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

### 3. Spots → Supabase

| | |
| --- | --- |
| **Interface** | `SpotRepository` |
| **À implémenter** | `list()`, `findBySlug()`, `findByPath()` |
| **Mock à remplacer** | `src/lib/providers/mock/spots.ts` |
| **Nouveau fichier** | `src/lib/providers/supabase/spots.ts` |
| **Ligne à changer** | `export const spots: SpotRepository = new SupabaseSpotRepository()` |

Le schéma de la table découle directement de `spotSchema`
(`src/data/schemas.ts`). Conserver `slug`, `country_slug` et `region_slug` :
ce sont les clés d'URL, et les changer casserait l'indexation.

`generateStaticParams` du détail spot appelle `spots.list()` : le build ira donc
chercher les spots en base. Prévoir `export const revalidate` en conséquence.

### 4. Liste d'attente → Supabase

| | |
| --- | --- |
| **Interface** | `WaitlistRepository` |
| **À implémenter** | `add(input, context)`, `count()` |
| **Mock à remplacer** | `src/lib/providers/mock/waitlist.ts` |
| **Nouveau fichier** | `src/lib/providers/supabase/waitlist.ts` |
| **Ligne à changer** | `export const waitlist: WaitlistRepository = new SupabaseWaitlistRepository()` |

`insert into waitlist (email, source) values (...) on conflict (email) do nothing`,
puis renvoyer `{ ok: true, alreadyRegistered: <aucune ligne insérée> }`. Le route
handler `src/app/api/waitlist/route.ts` ne change pas d'une ligne.

**À remplacer en même temps :** le limiteur de débit de `src/lib/rate-limit.ts`
est en mémoire de processus. Il ne protège rien dès qu'il y a plusieurs
instances ou du serverless. Le remplacer par un compteur Redis.

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

Lighthouse mobile, build de production, 8 URL couvrant les 5 pages :

| | Performance | Accessibilité | SEO | Bonnes pratiques |
| --- | --- | --- | --- | --- |
| Toutes les pages | 96–99 | 100 | 100 | 100 |

`npm run build`, `npm run typecheck` et `npm run lint` passent sans erreur ni
avertissement. 195 tests unitaires. Aucun débordement horizontal à 375 px.

## Déploiement

Aucune base de données n'est nécessaire à ce stade, et Open-Meteo ne demande pas
de clé. Sur Vercel : importer le dépôt et déployer. **Aucune variable
d'environnement n'est requise** — sans `NEXT_PUBLIC_SITE_URL`, les URL
canoniques sont déduites du domaine que Vercel injecte lui-même.

Node 20.9 ou plus est exigé via `engines`. Un projet Vercel resté sur Node 18
échoue avant même la compilation ; ce champ force le bon choix.

Les inscriptions à la liste d'attente atterrissent dans le répertoire temporaire
de l'instance et **n'y survivent pas** — acceptable pour une démonstration, pas
pour une collecte réelle, d'où l'étape Supabase.

### Si le build échoue

| Symptôme dans le log | Cause | État |
| --- | --- | --- |
| `Failed to collect page data` + `TypeError: Invalid URL` | `NEXT_PUBLIC_SITE_URL` sans `https://`. Le message ne nomme jamais la variable. | Corrigé : la valeur est normalisée, jamais passée telle quelle à `new URL()`. |
| Build qui reste bloqué puis est tué | Un appel Open-Meteo qui ne répond pas, sans refuser la connexion. | Corrigé : délai maximal de 8 s par appel, puis repli sur les données simulées. |
| `Node.js Version 18.x is deprecated` | Projet Vercel réglé sur une version retirée. | Corrigé : `engines.node` impose ≥ 20.9. |
| `npm ci` échoue | `package-lock.json` désynchronisé. | Vérifié : `npm ci` passe sur un clone propre. |

En dernier recours, `WEATHER_PROVIDER=mock` construit le site sans aucun appel
réseau — utile pour isoler un problème de build d'un problème de fournisseur.
