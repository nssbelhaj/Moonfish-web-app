# API publique v1

Le contrat entre `lunamarea.fr` et l'application mobile.

Base : `https://lunamarea.fr/api/v1`

---

## Les règles qui valent pour toutes les routes

**Une enveloppe unique.** Succès et échec ont la même forme, toujours :

```jsonc
{ "ok": true,  "donnees": { … } }
{ "ok": false, "code": "non-authentifie", "message": "…", "champ": "email" }
```

`champ` n'apparaît que sur une saisie refusée. Une application installée
survit à son serveur : elle rencontrera des versions de l'API que son auteur
n'a pas vues, et une forme constante lui permet de traiter l'échec au même
endroit quelle que soit la route.

**L'application affiche `message`, elle réagit sur `code`.** Traduire un
message pour décider quoi faire reviendrait à comparer des phrases, qui
changent.

| `code` | Statut | Ce que l'application doit faire |
| --- | --- | --- |
| `saisie-invalide` | 400 · 409 · 413 · 422 | Montrer `message` sur le champ `champ`. Ne pas réessayer tel quel. |
| `non-authentifie` | 401 | Effacer le jeton du trousseau, proposer la connexion. |
| `introuvable` | 404 | Le spot n'existe plus : rafraîchir le catalogue. |
| `trop-de-demandes` | 429 | Attendre `Retry-After` **secondes**. Ne pas reboucler. |
| `comptes-fermes` | 503 | Les comptes ne sont pas configurés sur ce déploiement. Masquer les écrans de compte, le reste fonctionne. |
| `indisponible` | 503 | Panne passagère. Réessayer plus tard, garder la saisie. |

**En-têtes.** Toute réponse porte `content-type: application/json; charset=utf-8`
et `x-luna-api: 1`. Le `charset` est écrit à la main : les messages sont en
français, et un client qui suppose du latin-1 faute de déclaration afficherait
du charabia.

**Aucun en-tête CORS**, délibérément. Voir le README.

**Authentification.** `Authorization: Bearer <jeton>`, le jeton rendu par
`/auth/connexion` ou `/auth/inscription`. Le schéma est lu sans tenir compte de
la casse (RFC 7235). Le jeton se range dans **`expo-secure-store`**, c'est-à-dire
le trousseau du système, et nulle part ailleurs : il vaut preuve d'identité à
lui seul, et `AsyncStorage` est lisible par une sauvegarde de l'appareil.

---

## Lectures publiques

### `GET /spots`

Le catalogue complet. **37 ko, 9,7 ko compressés.** En cache une heure.

C'est la première route que l'application appelle, et elle porte les positions :
c'est ce qui permet de calculer « le spot le plus proche » SUR L'APPAREIL. Aucun
point d'accès du serveur ne sait recevoir une position, et un test refuse qu'un
seul se mette à en accepter une.

```jsonc
{ "ok": true, "donnees": { "spots": [ {
  "slug": "pen-hat", "name": "Pen Hat",
  "countrySlug": "france", "countryName": "France",
  "regionSlug": "bretagne", "regionName": "Bretagne",
  "lat": 48.2856, "lng": -4.6017, "timezone": "Europe/Paris",
  "facingDeg": 290, "sea": "atlantique",
  "exposure": "tres-expose", "bottom": "sable-roche", "type": "plage",
  "techniques": ["surfcasting", "lancer-ramener", "rockfishing"],
  "species": ["Bar", "Lieu jaune", "…"],
  "meanTideRangeM": 5.6, "summary": "…", "access": "…"
} ] } }
```

### `GET /spots/{slug}/prevision`

Sept jours, douze créneaux de deux heures par jour. **176 ko, 16 ko compressés** —
la taille à retenir pour le téléchargement hors ligne des favoris. En cache une
heure, les 42 spots pré-rendus au build.

```jsonc
{ "ok": true, "donnees": {
  "spot": { … },
  "generatedAt": "2026-09-17T12:00:00.000Z",
  "days": [ {
    "date": "2026-09-16T22:00:00.000Z",
    "slots": [ {
      "start": "2026-09-17T06:00:00.000Z",
      "end":   "2026-09-17T08:00:00.000Z",

      "score": {
        "value": 5.6,              // null si AUCUN facteur n'est disponible
        "label": "Passable",       // Médiocre · Passable · Bon · Excellent
        "coverage": 1,             // part du poids nominal réellement couverte
        "reasons": ["…", "…"],
        "breakdown": {
          "tide":   { "score": 7.2, "weight": 0.32, "nominalWeight": 0.32, "note": "…" },
          "wind":   { "score": null, "weight": 0, "nominalWeight": 0.23, "note": "vent indisponible…" }
          // … swell, solunar, pressure, light
        }
      },

      // ═══ FRÈRE de `score`, jamais son enfant ═══
      "safety": { "level": "prudence", "message": "Vigilance : vent de 37 km/h…" },

      "conditions": { "windSpeedKmh": 37, "swellHeightM": 1.4, "…": null },
      "tide": { "hoursFromHighTide": -1.5, "coefficient": 78, "state": "falling" },
      "lightPhase": "dawn"
    } ],
    "sunrise": "…", "sunset": "…",
    "moonrise": null,            // null est une VALEUR : la Lune saute une journée
    "moonset": "…",              //   civile deux fois par mois
    "tideEvents": [ { "time": "…", "type": "high", "heightM": 5.1, "coefficient": 78 } ],
    "moonIlluminationPct": 42, "moonAgeDays": 7.1, "moonWaxing": true,
    "best": { … }
  } ],
  "tideEvents": [ … ],
  "current": { … },              // créneau en cours, ou le premier à venir
  "best": { … },                 // meilleur des 7 jours, JAMAIS un créneau en danger
  "nextGood": { … },             // prochaine fenêtre au moins « Bonne »
  "sources": { "tide": …, "weather": …, "astro": … }
} }
```

#### Ce que l'application doit respecter en affichant ça

1. **`safety` s'affiche AU-DESSUS du score**, jamais à côté, et le bandeau
   `danger` ne se referme pas. Un créneau peut être excellent au sens
   halieutique et dangereux au sens humain.
2. **`value: null` s'écrit « —,— »**, jamais 0, jamais un tiret seul. Un zéro se
   lirait comme une mauvaise note et affirmerait une condition qu'on n'a pas
   mesurée.
3. **Un facteur à `score: null`** garde sa ligne dans le détail, avec « écarté du
   calcul (pesait 23 %) ». C'est `nominalWeight` qui donne ce pourcentage.
4. **Trois canaux pour le palier** : le chiffre, la couleur, et une forme
   (`bar` · `diamond` · `disc` · `target` selon `label`). L'écran doit rester
   lisible en niveaux de gris.
5. **Aucune promesse de prise.** Un score dit ce que valent les conditions,
   jamais ce qu'on va attraper.

#### `sources`

```jsonc
{
  "name": "Modèle de démonstration Luna Marea",
  "kind": "simulated",        // measured · forecast · computed · simulated
  "precision": "onde M2…",
  "url": null,
  "degraded": false,          // true = REPLI APRÈS PANNE, pas mode démo choisi
  "validityHours": null,      // null = ne périme pas
  "refreshedAt": "2026-09-17T12:00:00.000Z"   // du FOURNISSEUR, pas du rendu
}
```

`kind: "simulated"` **doit** être annoncé sur chaque écran qui affiche la donnée,
exactement comme le site l'annonce. `degraded` distingue une vraie panne
(voyant « Interrompu ») d'une démonstration délibérée : un voyant d'alerte
permanent apprend à ne plus le regarder.

`refreshedAt` + `validityHours` sont ce qui permet d'écrire, hors ligne,
« prévision du 12 septembre à 18 h, pas rafraîchie depuis ». Sans eux
l'application afficherait l'heure de son propre appel — et une table sortie
d'un cache de 24 h se présenterait comme fraîche de la minute.

### `GET /spots/{slug}/contributions`

Avis et prises **publiques** d'un spot. Les prises privées ne quittent pas la
base : le filtre est dans le SQL, pas dans la sérialisation.

```jsonc
{ "ok": true, "donnees": {
  "reviews": [ { "id": "…", "authorName": "Camille", "rating": 4, "comment": "…", "createdAt": "…", "updatedAt": "…" } ],
  "catches": [ { "id": "…", "authorName": "Camille", "species": "Bar", "lengthCm": 54,
                 "weightG": 1800, "released": true, "caughtAt": "…", "note": null,
                 "photoUrl": "https://lunamarea.fr/api/photos/…", "createdAt": "…" } ],
  "averageRating": 4,      // null s'il n'y a aucun avis — jamais 0
  "reviewCount": 1,
  "accountsOpen": true
} }
```

---

## Authentification

### `POST /auth/inscription`

```jsonc
{ "email": "…", "password": "…", "passwordConfirm": "…",
  "firstName": "Camille", "lastName": "Renard",
  "birthDate": "1990-04-12", "consentement": "oui" }
```

Les règles sont celles du formulaire du site, sans exception : **15 ans
révolus** (obligation légale — la faire varier selon le bouton reviendrait à ne
pas l'avoir) et consentement explicite. Le nom affiché part du **prénom seul** :
y mettre « Prénom NOM » publierait le nom de famille de quelqu'un qui ne l'a
jamais demandé.

→ `{ "jeton": "…", "expiration": "2026-10-17T…", "displayName": "Camille" }`
→ `409` si l'adresse est prise (et on le DIT, contrairement à la connexion).

### `POST /auth/connexion`

```jsonc
{ "email": "…", "password": "…" }
```

→ `{ "jeton": "…", "expiration": "…" }`

**« Adresse inconnue » et « mot de passe faux » se répondent exactement
pareil**, même code et même message, et en un temps comparable. Les distinguer
transformerait la route en outil de vérification d'adresses. Le verrou de
compte, lui, s'annonce (`429`) : il ne révèle rien à qui vient de le
déclencher, et le taire laisserait la personne légitime devant un mot de passe
qu'elle sait juste.

### `DELETE /auth/session`

Répond `200` même sans jeton valide : se déconnecter est le seul geste qui doit
toujours aboutir. L'application efface son jeton dès réception.

La session disparaît de la table — la coupure est effective **à la requête
suivante**, sur tous les appareils concernés par ce jeton.

---

## Compte (jeton requis)

### `GET /compte`

Tout en un appel : quatre allers-retours à l'ouverture, sur une 4G faible au
bord de l'eau, c'est la différence entre un écran qui s'affiche et un écran qui
tourne.

```jsonc
{ "ok": true, "donnees": {
  "account": { "id": "…", "email": "…" },
  "profile": { "displayName": "Camille", "notifyOutings": true, … },
  "favorites": [ { "spotSlug": "pen-hat", "createdAt": "…" } ],
  "outings":   [ { "id": "…", "spotSlug": "…", "plannedAt": "…", "alert": true, "minScore": 6, … } ],
  "reviews":   [ … ],
  "catches":   [ { …, "visibility": "privee" } ],   // le carnet : privées comprises
  "catchLog":  { … }                                 // résumé calculé côté serveur
} }
```

`catchLog` est produit par la fonction du site. Laisser le téléphone recalculer
« votre plus grande prise par espèce » créerait une seconde arithmétique, pour
la même raison qu'on refuse un second calcul du score.

### `POST /compte/avis`

```jsonc
{ "spotSlug": "pen-hat", "rating": 4, "comment": "Belle descendante." }
```

`comment` est facultatif. Exige un nom affiché (`409` sinon) : un avis est
signé, et fabriquer un nom publierait une identité que personne n'a choisie.

### `POST /compte/prises` — `multipart/form-data`

| Champ | |
| --- | --- |
| `spotSlug` `species` `caughtAt` | requis |
| `lengthCm` `weightG` `note` | facultatifs, vides acceptés |
| `released` | `"true"` / `"false"` |
| `visibility` | `"privee"` (défaut) ou `"publique"` |
| `photo` | JPEG, **déjà nettoyé de ses métadonnées sur l'appareil** |

> ### ⚠ Le retrait EXIF est la responsabilité de l'application
>
> Une photo de téléphone porte les coordonnées GPS de la prise de vue. Publier
> une photo de bar sans y toucher, c'est publier la position d'un poste — ou,
> si elle a été prise en rentrant, celle d'un domicile.
>
> **`expo-image-picker` avec `exif: false` ne retire RIEN du fichier.** Il se
> contente de ne pas vous montrer les données ; le fichier sur le disque garde
> ses coordonnées. Seul un **réencodage** les enlève — c'est la méthode du site
> (`lib/photo/strip-metadata.ts`), et pour la même raison : décoder puis
> redessiner ne conserve que les pixels, ni EXIF, ni XMP, ni IPTC, ni vignette
> d'aperçu — cette dernière étant le piège classique des outils qui retirent les
> coordonnées et laissent une miniature intacte, elle-même géolocalisée.
>
> Le serveur ne nettoie pas, il suppose — et vérifie ce qu'il peut : il refuse
> tout ce dont les octets ne commencent pas par la signature JPEG. **Ce qui
> n'est jamais parti n'a pas à être effacé.**

### `PUT` · `DELETE /compte/favoris/{slug}`

`PUT` est **idempotent** : ajouter deux fois ne fait rien et ne s'en plaint pas.
C'est ce qui permet à l'application de rejouer sa file d'actions en attente au
retour du réseau, sans se souvenir de ce qui est déjà passé.

### `POST /compte/sorties`

```jsonc
{ "spotSlug": "…", "plannedAt": "2026-09-20T06:00:00.000Z",
  "note": null, "alert": true, "minScore": 6 }
```

N'exige pas de nom affiché : une sortie n'est vue de personne d'autre.
`/api/entretien` ramasse chaque jour les sorties prévues dans les **36 heures**
— pas 24 : la tâche tourne une fois par jour à une heure qu'on ne choisit pas
finement, et une sortie à 8 h avec une tâche à 9 h la veille ne se verrait
jamais.

### `POST` · `DELETE /compte/appareils`

```jsonc
{ "token": "…", "platform": "ios", "label": "iPhone de Camille" }
```

Le jeton est attaché au compte **authentifié de la requête**, jamais à un
identifiant fourni dans le corps : c'est ce qui empêche d'inscrire son
téléphone aux alertes de quelqu'un d'autre.

Réenregistrer le même jeton est sans effet (l'application le refait à chaque
démarrage — c'est la seule façon de savoir qu'il est encore valide). Un
appareil disparaît avec le compte, par cascade : sans quoi le serveur
continuerait de notifier quelqu'un qui a demandé à être oublié.

Ni modèle d'appareil, ni version du système, ni identifiant publicitaire : ils
rendraient le débogage d'un cheveu plus facile et transformeraient la table en
profil.

### `PUT /compte/profil`

```jsonc
{ "displayName": "Camille", "profil": { "city": "Brest", "bio": null } }
```

`displayName` est le seul champ obligatoire, et le seul PUBLIC : il signe les
avis et les prises publiées. Le reste ne sort nulle part aujourd'hui.

### `PUT /compte/preferences`

```jsonc
{ "notifyOutings": true, "notifyNews": false }
```

Deux booléens, pas un réglage libre : ce qui n'est pas listé n'est pas envoyé.
C'est ce qui permet à la page de confidentialité de dire exactement ce qu'on
envoie. `notifyOutings` commandera aussi les notifications push — même
consentement, autre canal.

### `PUT` · `DELETE /compte/prises/{id}`

`PUT { "visibility": "publique" | "privee" }` publie une prise ou la reprend.
`DELETE` la supprime. Les deux rafraîchissent la page du spot : elle est
pré-rendue une heure, et **un retrait qui se voit encore n'est pas un
retrait**.

### `DELETE /compte/sorties/{id}`

Annule la sortie ET son alerte : la tâche d'entretien ne ramasse que les
lignes existantes. Pas de second geste, pas d'alerte orpheline.

### `GET /compte/export`

Droit d'accès et de portabilité. Il porte aussi ce qui ne s'affiche nulle part
— à commencer par les appareils de notification. Un export limité à ce que
l'interface montre serait incomplet sans que personne puisse s'en apercevoir.
Aucun budget d'appel : exercer un droit n'a pas à être rationné.

### `DELETE /compte`

```jsonc
{ "confirmation": "supprimer" }
```

Le droit à l'oubli, **depuis l'application** — l'App Store l'exige de toute
application permettant de créer un compte, et renvoyer vers un navigateur
poserait une friction exactement là où il ne faut pas.

La confirmation explicite n'est pas un ornement : un `DELETE` nu effacerait un
compte sur une requête rejouée ou un bouton mal câblé, et le bouton voisin à
l'écran est « se déconnecter ». Les pages du site sont rafraîchies avant que
les lignes ne disparaissent, sans quoi un avis resterait affiché une heure
après l'effacement — défaut constaté en production.

---

---

## Budgets d'appel

Déclarés dans `src/lib/limites.ts`, partagés avec le site.

| Route | Budget | Clé |
| --- | --- | --- |
| `/auth/connexion` | 20 / 15 min | adresse d'appel |
| `/auth/inscription` | 5 / heure | adresse d'appel |
| `/compte/*` (écritures) | 40 / heure | **compte** |
| `/compte/prises` avec photo | + 20 / heure | **compte** |
| Lectures publiques | — | servies depuis le cache |

Les routes de compte comptent par **utilisateur**, pas par adresse IP, et c'est
la différence majeure avec le web : derrière le NAT d'un opérateur mobile, des
milliers d'abonnés partagent une adresse. Un budget par IP y enfermerait dehors
des gens qui n'ont rien fait, tout en laissant passer celui qui change de
réseau.
