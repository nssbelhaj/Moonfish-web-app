# Mise en service des comptes

Ce que couvre ce document : passer d'un dépôt qui compile à des comptes qui
fonctionnent, sur un hébergement Hostinger.

Rien de tout cela n'est nécessaire pour que le site tourne. Sans base ni
courriel, Moonfish fonctionne entièrement et annonce que les comptes ne sont
pas ouverts — sans formulaire qui échouerait, sans avis d'exemple pour meubler.

---

## Ce qu'il faut, et pourquoi les deux

| | Sert à | Sans lui |
| --- | --- | --- |
| Une base MySQL | comptes, sessions, avis, prises | comptes fermés |
| Un envoi SMTP | les liens de connexion | comptes fermés |

Les deux, pas l'un ou l'autre : une base sans courriel donnerait un formulaire
de connexion qui n'envoie jamais rien, et un courriel sans base n'aurait nulle
part où écrire la session. `accountsEnabled()` exige les deux.

## 1. La base

Dans hPanel, la base managée du plan est déjà là et ses identifiants sont
câblés dans l'application. Il suffit de les reporter :

```
DATABASE_URL=mysql://utilisateur:motdepasse@hote:3306/base
```

ou, si vous préférez les variables séparées : `MYSQL_HOST`, `MYSQL_USER`,
`MYSQL_PASSWORD`, `MYSQL_DATABASE`, `MYSQL_PORT`.

Puis :

```bash
node scripts/migrer-mysql.mjs
```

Le script applique `db/migrations/*.sql` instruction par instruction et liste
les tables obtenues. Il est idempotent : le relancer ne casse rien.

## 2. Le courriel

Une boîte aux lettres du domaine suffit. Dans hPanel : **Emails → Créer un
compte**, puis :

```
EMAIL_SERVER=smtp://bonjour%40votre-domaine:MOTDEPASSE@smtp.hostinger.com:587
EMAIL_FROM=bonjour@votre-domaine
```

Le `@` de l'identifiant doit être encodé `%40` : c'est une URL, et un `@` non
encodé coupe l'adresse en deux. C'est la cause d'échec la plus fréquente ici,
et le message d'erreur ne la désigne pas.

Port 587 en STARTTLS ; 465 en SSL si 587 est filtré. L'adresse d'expédition
doit appartenir au domaine que vous authentifiez (SPF, DKIM) : envoyer depuis
un domaine qu'on ne contrôle pas expédie les liens droit dans les indésirables.

## 3. Les deux secrets

```
AUTH_SECRET=…      # openssl rand -base64 32
AUTH_URL=https://votre-domaine
UPLOADS_DIR=/home/votre-compte/moonfish-photos
CRON_SECRET=…      # une chaîne aléatoire quelconque
```

**`UPLOADS_DIR` doit pointer HORS du répertoire de l'application.** Un
déploiement depuis Git remplace ce répertoire : une photo écrite dedans
disparaîtrait à la mise en ligne suivante, sans erreur et sans trace. Le code
avertit au démarrage en production si le chemin est à l'intérieur, mais il ne
peut pas deviner où le mettre.

## 4. L'entretien quotidien

Une tâche cron, dans hPanel :

```
curl -fsS -H "Authorization: Bearer VOTRE_CRON_SECRET" https://votre-domaine/api/entretien
```

Elle purge les sessions et les liens de connexion périmés. Sans elle, deux
tables grossissent indéfiniment : Auth.js ne supprime que ce qu'il touche, et
un lien jamais cliqué reste en base pour toujours — de l'espace consommé, et
des données personnelles gardées sans raison.

## 5. Vérifier

```bash
DATABASE_URL=… npm run test
```

Les tests d'intégration (`src/lib/providers/mysql/__tests__/`) s'exécutent
contre la base configurée. Sans `DATABASE_URL`, ils sont ignorés plutôt que
rouges — un clone du dépôt doit pouvoir lancer les tests sans serveur.

Ce qu'ils vérifient, entre autres :

- qu'un pêcheur ne peut PAS supprimer l'avis d'un autre ;
- que la suppression refusée ne touche pas non plus à sa photo ;
- que l'instant d'une prise survit à l'aller-retour en base sans dérive de
  fuseau — deux heures d'écart en été, soit le mauvais créneau de marée ;
- que l'effacement d'un compte emporte profil, avis, prises et photos, et rien
  de ce qui appartient à quelqu'un d'autre.

## 6. Le parcours à faire une fois, à la main

Un test ne remplace pas une boîte aux lettres réelle :

1. `/compte` → adresse, consentement, demander le lien ;
2. ouvrir le lien reçu → revenir connecté ;
3. choisir un nom affiché ;
4. sur un spot, onglet **Espèces** → publier un avis ;
5. déclarer une prise **avec photo** ;
6. `/compte` → télécharger l'export JSON ;
7. `/compte` → supprimer le compte, puis **recharger la page du spot** :
   l'avis doit avoir disparu immédiatement.

Le point 7 est le plus important. Il a échoué la première fois : les données
étaient bien effacées de la base, mais la page de spot, pré-rendue, continuait
de les afficher jusqu'à une heure. Un effacement qui se voit encore n'est pas
un effacement — c'est corrigé, et c'est ce qu'il faut revérifier.

---

## Ce que la sécurité repose désormais sur

La version PostgreSQL s'appuyait sur la sécurité au niveau des lignes : le
moteur refusait lui-même une écriture au nom d'autrui. **MySQL n'a pas
d'équivalent.**

La garantie est devenue conventionnelle, et trois mécanismes lui donnent du
poids :

1. les signatures — `deleteReview(id, userId)` — rendent l'oubli du
   propriétaire impossible à compiler ;
2. `src/lib/db/__tests__/proprietaire.test.ts` échoue si une modification d'une
   table détenue par un utilisateur ne porte pas `user_id = ?`, si du SQL
   apparaît hors des modules autorisés, ou si une valeur est interpolée dans
   une requête ;
3. les tests d'intégration essaient réellement de supprimer le bien d'autrui,
   contre une vraie base.

C'est plus faible qu'une politique appliquée par le moteur, et le dire vaut
mieux que de faire comme si le modèle n'avait pas changé. En contrepartie, tout
est vérifiable en local : la version PostgreSQL, elle, n'a jamais été exécutée
contre un vrai serveur.
