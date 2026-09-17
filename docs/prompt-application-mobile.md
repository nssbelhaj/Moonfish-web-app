# Luna Marea — application mobile iOS et Android

Tu construis l'application mobile de **Luna Marea**, un service qui dit à un
pêcheur du bord quand sortir : un score sur 10 par créneau de 2 heures, sur 7
jours, calculé à partir de la marée, du vent, de la houle et des périodes
solunaires.

Le site web existe, il est en production sur **https://lunamarea.fr**, et son
code est dans le dépôt **nssbelhaj/Moonfish-web-app** (branche
`claude/moonfish-mvp-web-t1l7st`). Commence par le lire : `README.md` d'abord,
puis `src/lib/scoring/`, `src/data/schemas.ts`, `src/data/spots.ts`. Tout est
en français — le code, les commentaires, les noms de variables, l'interface.

Tout ce qui suit est en français, y compris tes commentaires de code.

---

## L'architecture, et la décision qui la gouverne

**L'application mobile ne recalcule RIEN. Elle affiche ce que l'API lui
envoie.**

Ce n'est pas une paresse, c'est la seule position tenable. Le score porte une
règle de sécurité non négociable — houle > 2,5 m OU vent > 50 km/h ⇒
`safety.level = 'danger'` — et cette règle décide si quelqu'un va se mettre en
danger sur des rochers. Deux implémentations finissent toujours par diverger :
un seuil ajusté d'un côté, un arrondi de l'autre, et un jour l'application dit
« Bon » là où le site dit « Danger ». Il y aura donc **une** implémentation,
côté serveur, et le mobile en sera un client.

Corollaire : le premier chantier n'est pas l'application, c'est **l'API**.

### Étape 1 — l'API publique (dans le dépôt web)

Le site n'a aujourd'hui aucune API : tout est en composants serveur qui lisent
directement les fournisseurs. Il faut ajouter `src/app/api/v1/`, versionnée
dès le départ (une app installée survit à son serveur : on ne casse jamais une
route, on en publie une nouvelle).

Routes minimales, toutes en JSON, toutes avec `content-type:
application/json; charset=utf-8` :

| Route | Rend |
| --- | --- |
| `GET /api/v1/spots` | le catalogue : slug, nom, pays, région, type, fond, techniques, lat/lng, fuseau |
| `GET /api/v1/spots/{slug}/prevision` | `SpotForecast` complet : jours, créneaux, scores, marées, **et `sources`** |
| `GET /api/v1/spots/{slug}/contributions` | avis, note moyenne, prises déclarées avec URL de photo |
| `POST /api/v1/auth/connexion` | e-mail + mot de passe → jeton de session |
| `POST /api/v1/auth/inscription` | idem, avec les champs d'inscription existants |
| `DELETE /api/v1/auth/session` | déconnexion |
| `GET /api/v1/compte` | profil, favoris, sorties, carnet |
| `POST /api/v1/compte/prises` | déclarer une prise (photo en multipart) |
| `POST /api/v1/compte/avis` | noter un spot |
| `PUT /api/v1/compte/favoris/{slug}` · `DELETE` | ajouter / retirer un favori |
| `POST /api/v1/compte/sorties` | programmer une sortie |
| `POST /api/v1/compte/appareils` | enregistrer un jeton de notification push |

Contraintes non négociables sur cette API :

- **`sources` voyage avec les données.** Chaque réponse de prévision porte la
  provenance de chaque mesure (`measured` / `forecast` / `computed` /
  `simulated`) et sa fraîcheur. L'application doit pouvoir dire « marée
  simulée » exactement là où le site le dit. Une donnée qui circule sans sa
  provenance est la panne que ce projet refuse depuis le début.
- **La règle de sécurité n'est jamais dérivée du score.** Elle arrive dans le
  JSON comme un champ à part, et l'app l'affiche **au-dessus** du score, pas
  à côté.
- **Réutilise les modules existants** (`getSpotForecast`, `contributions`,
  `comptes.ts`). L'API est une façade, pas une seconde logique métier.
- **Authentification par jeton porteur.** La table `sessions` existe déjà et
  les sessions sont en base — une déconnexion prend effet immédiatement. Le
  mobile envoie `Authorization: Bearer <jeton>` ; le serveur le cherche dans
  la même table que le cookie du web. Ne réinvente pas un second système.
- **Les limites de débit existantes s'appliquent** (`src/lib/limites.ts`) :
  une API publique sans compteur est une invitation.
- **Zod valide toutes les entrées**, comme partout ailleurs dans ce dépôt.

Écris les tests d'API avant de brancher le mobile dessus. Le dépôt en compte
plus de 870 et ils passent : ne casse pas cette habitude.

### Étape 2 — l'application

**React Native avec Expo** (SDK courant), TypeScript strict, `expo-router`.

Pourquoi Expo plutôt que Flutter ou du natif : un seul code pour les deux
magasins, le même langage que le reste du projet, les mises à jour par OTA
pour les correctifs d'affichage, et `expo-notifications` /
`expo-secure-store` / `expo-image-picker` couvrent tout ce dont l'app a
besoin sans module natif à écrire.

Dépôt : **un nouveau dépôt**, `nssbelhaj/lunamarea-mobile`. Pas de monorepo —
le site est en production sur Hostinger avec un déploiement branché sur la
racine du dépôt, et le déplacer pour partager du code qu'on a justement décidé
de ne pas partager serait un risque sans contrepartie.

---

## Ce que l'application apporte, et qu'un site mobile ne peut pas

C'est la question à laquelle chaque écran doit répondre. Si la réponse est
« rien », l'écran n'a pas besoin d'exister dans l'app.

1. **Le hors-ligne.** On pêche là où il n'y a pas de réseau. La prévision des
   spots favoris est téléchargée quand il y a du signal et reste lisible sans.
   L'app affiche alors franchement l'âge de la donnée : « prévision du 12
   septembre à 18 h, pas rafraîchie depuis ». Jamais une donnée périmée
   présentée comme fraîche.
2. **Les notifications push.** Les alertes de sortie partent aujourd'hui par
   courriel, la veille à 18 h. Sur mobile elles deviennent une notification —
   c'est le vrai gain. La tâche `/api/entretien` existe déjà et envoie les
   courriels ; elle enverra aussi les push.
3. **L'appareil photo.** Déclarer une prise depuis le bord, photo comprise.
   **Les métadonnées EXIF sont retirées sur l'appareil, avant tout envoi** —
   c'est déjà la règle du site (`scripts/verifier-exif.mjs` le prouve), et
   elle vaut d'autant plus ici que la position GPS d'une photo de pêche
   trahit un poste.
4. **La marée en un coup d'œil**, depuis l'écran d'accueil (widget) ou un
   raccourci.

---

## Les écrans de la v1

Cinq, pas davantage.

1. **Aujourd'hui** — le spot favori le plus proche (ou le premier favori) :
   score du créneau en cours, courbe de marée, prochaine bonne fenêtre, et
   l'avertissement de sécurité en tête s'il s'applique.
2. **Carte** — les spots regroupés par proximité à l'échelle affichée (le
   site le fait déjà, lis `src/lib/map/regroupement.ts` pour la règle :
   jamais deux pastilles qui se chevauchent). Fond de carte via le relais du
   site, pas en direct.
3. **Spot** — prévision 7 jours, espèces, avis et photos des autres pêcheurs.
4. **Carnet** — les prises, les statistiques, et le bouton « déclarer » avec
   l'appareil photo.
5. **Compte** — profil, favoris, sorties, préférences de notification,
   export et effacement.

---

## Les règles du projet, qui valent aussi ici

Elles ne sont pas négociables et elles se vérifient par des tests.

- **Aucune promesse de prise.** Le site dit « la mer décide ». Un score dit ce
  que valent les conditions, jamais ce qu'on va attraper. Pas de « bonne
  pêche garantie », pas de gamification, pas de badge.
- **La sécurité prime sur le score**, et s'affiche au-dessus de lui.
- **Toute donnée porte sa provenance.** Une marée simulée est annoncée comme
  simulée, sur chaque écran qui l'affiche.
- **La position ne quitte jamais l'appareil.** Le site n'a aucun point
  d'accès qui sache recevoir une position ; l'app ne doit pas en créer un. La
  proximité se calcule localement, contre la liste des spots déjà
  téléchargée.
- **Aucun traceur, aucune mesure d'audience tierce, aucune publicité.** La
  page de confidentialité du site l'affirme et des tests la tiennent. Un SDK
  d'analytics dans l'app rendrait cette page fausse.
- **Trois canaux pour le score** : le chiffre, la couleur du palier, et une
  forme selon le type de spot. L'app doit rester lisible en niveaux de gris.
- **Accessibilité** : cibles tactiles de 48 px minimum, contrastes AA,
  `accessibilityLabel` sur tout ce qui est actionnable, et le respect de
  « animations réduites ».
- **Français partout**, y compris les messages d'erreur : ils nomment la cause
  ET le remède, comme dans le reste du projet.

---

## Charte visuelle

Reprends les jetons de `src/app/tokens.css` — ils ont été calculés, pas
choisis : contrastes vérifiés en thème clair ET nuit, et séparation
perceptuelle entre paliers de score voisins. Ne les réinvente pas, traduis-les
en constantes TypeScript. Polices : Spectral pour les titres, Archivo pour le
texte.

---

## Comment travailler

1. Lis d'abord le dépôt web, en entier. Le `README.md` explique les décisions
   et les pannes qui les ont motivées — c'est le document le plus utile.
2. Propose-moi un plan avant d'écrire du code, et la liste des décisions que
   tu ne peux pas prendre seul.
3. L'API d'abord, testée, déployée. L'application ensuite.
4. Un commit par idée, message en français expliquant **pourquoi**, pas quoi.
5. Montre-moi des captures d'écran réelles à chaque étape, pas des
   descriptions.
6. Ne me demande jamais un mot de passe, une clé ou un secret dans la
   conversation : les secrets vivent chez la plateforme.

## Ce qu'il me faudra fournir

Dis-le-moi dès que tu en as besoin, en nommant la variable, jamais sa valeur :

- un compte Apple Developer (99 €/an) et un compte Google Play (25 € une fois) ;
- les identifiants OAuth Google pour mobile (distincts de ceux du web) ;
- les clés de notification : APNs pour iOS, Firebase pour Android.

Commence par lire le dépôt web et me proposer ton plan.
