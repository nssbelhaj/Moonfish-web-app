# Moonfish — MVP web

Score de pêche du bord sur 7 jours, spot par spot. Marée, vent, houle, périodes
solunaires et lumière, pondérés et expliqués.

État des données, à jour :

| Donnée | Source | Nature |
| --- | --- | --- |
| Vent, houle, températures, pression | Open-Meteo (modèles Marine & Forecast) | **Prévision réelle** |
| Lever/coucher du Soleil, phase de Lune | Calcul local (NOAA + lunaison) | **Calculé** |
| Marées et coefficients | Modèle de démonstration Moonfish | **Simulé** |

Les marées restent inventées, et le site le dit sur chaque page qui en affiche.
Les avertissements sont pilotés par la source : ils disparaîtront d'eux-mêmes
quand le fournisseur de marées passera au réel — il n'y a rien à retirer à la main.

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
| `npm test` | 95 tests unitaires (Vitest), hermétiques — aucun accès réseau |
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
│   │       ├── page.tsx          Détail spot — generateStaticParams sur les 12
│   │       └── opengraph-image.tsx  Image OG dynamique, pré-rendue au build
│   ├── guides/                   Index + article ([slug])
│   ├── pricing/                  Gratuit vs Pro, aucun paiement branché
│   ├── api/waitlist/route.ts     POST — Zod + limiteur de débit + écriture
│   ├── sitemap.ts, robots.ts     Générés depuis les mêmes sources que les pages
│   ├── globals.css               Variables CSS des deux thèmes ← POINT D'ENTRÉE DESIGN
│   └── layout.tsx                Coquille, polices auto-hébergées, métadonnées de base
│
├── components/
│   ├── score/                    ScoreGauge, ScoreBadge, ScoreShape, ScoreReasons,
│   │                             ScoreBreakdown — les 4 canaux redondants du palier
│   ├── marine/                   TideChart, WindCompass, MoonPhase, TimeWindowBar
│   ├── spot/                     SpotCard, SpotResults, SafetyBanner
│   ├── data/                     DataSourceTag, DemoDataNotice ← honnêteté des données
│   ├── forms/                    EmailCaptureForm, SpotSearch, SpotFilters (les 3
│   │                             SEULS composants clients du projet)
│   ├── guides/, pricing/, layout/, ui/
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

### 1. Marées → Stormglass

| | |
| --- | --- |
| **Interface** | `TideProvider` dans `src/lib/providers/types.ts` |
| **À implémenter** | `getTideEvents(spot, range): Promise<Sourced<TideEvent[]>>` |
| **Mock à remplacer** | `src/lib/providers/mock/tide.ts` |
| **Nouveau fichier** | `src/lib/providers/stormglass/tide.ts` |
| **Ligne à changer** | `export const tides: TideProvider = new StormglassTideProvider(process.env.STORMGLASS_KEY!)` |

Appeler `GET https://api.stormglass.io/v2/tide/extremes/point` avec `lat`, `lng`,
`start`, `end`. Mapper chaque élément `{ time, type, height }` vers `TideEvent`.
Le coefficient n'est pas fourni par Stormglass : le récupérer auprès du SHOM ou
le conserver calculé (`tideCoefficientFor` dans `src/data/generators/tide.ts`),
en changeant alors `source.kind` en `'computed'` pour ce champ.

Rien d'autre ne bouge : `tideContextAt` (`src/lib/forecast/tide-context.ts`)
reconstruit déjà l'heure relative à la pleine mer, le coefficient et l'état de
marée **à partir des seuls extremums**, exactement la forme que renvoie
Stormglass. C'est le point d'architecture le plus important du projet.

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

Tester sans réseau : `node scripts/open-meteo-stub.mjs 4000` sert des réponses
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

---

## Où toucher au design

Deux fichiers, et deux seulement :

- **`tailwind.config.ts`** — palette, familles, échelle typographique, rayons,
  ombres. Traduction directe du handoff design v1.
- **`src/app/globals.css`** — variables CSS des deux thèmes. Le sombre est le
  défaut (`:root`), le clair est opt-in (`.theme-light`, posé sur les guides).

Les composants n'utilisent que les tokens sémantiques (`bg-card`, `text-fg`,
`var(--score-best)`…), jamais les littéraux. Changer un thème ne demande donc
aucune modification de composant.

---

## Le score

`computeScore(input: ScoreInput): ScoreResult` dans `src/lib/scoring/`.
Fonction pure : aucun accès réseau, aucune horloge, aucun système de fichiers.

| Facteur | Poids | Optimal |
| --- | --- | --- |
| Marée | 35 % | −2 h à +1 h autour de la pleine mer, ou descendante établie. Coefficient 70–95. Étale pénalisée. |
| Vent | 25 % | 10–25 km/h de secteur mer. Vent de terre modéré = correct. > 40 km/h = mauvais. |
| Houle | 20 % | 0,5–1,5 m. < 0,3 m trop calme, > 2,5 m mauvais. |
| Solunaire & lune | 15 % | Périodes majeures (zénith/nadir) et mineures (lever/coucher), bonus vive-eau. |
| Lumière | 5 % | Aube, crépuscule, nuit devant le plein jour. |

**Règle non négociable.** Si houle > 2,5 m **ou** vent > 50 km/h,
`safety.level` vaut `'danger'` et l'interface affiche un bandeau non refermable
au-dessus du score, quel que soit le score calculé. Cette évaluation vit dans
`src/lib/scoring/safety.ts` et n'est jamais dérivée du `breakdown` : c'est
volontaire, pour qu'aucune modification des pondérations ne puisse l'affaiblir.

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
| Toutes les pages | 97–98 | 100 | 100 | 100 |

`npm run build`, `npm run typecheck` et `npm run lint` passent sans erreur ni
avertissement. 95 tests unitaires. Aucun débordement horizontal à 375 px.

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
