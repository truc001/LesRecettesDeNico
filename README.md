# Les recettes de Nico

Carnet de recettes construit avec Next.js et prêt à être déployé sur Vercel.

## Développement

```bash
npm install
npm run dev
```

## Vérifications

```bash
npm run lint
npm run typecheck
npm test                # tests unitaires
npm run test:emulator   # règles Firestore et accès Firestore, dans l’émulateur local (Java requis)
```

Le test `test:emulator` utilise uniquement le projet de démonstration local `demo-nico-firestore`. Il vérifie les règles de sécurité (accès publics, écritures administrateur, refus, validation, limite d’envoi) puis exécute le vrai code de `lib/` contre l’émulateur. Les mêmes commandes tournent dans GitHub Actions (`.github/workflows/ci.yml`).

Pour faire tourner le site contre l’émulateur, définissez `FIRESTORE_EMULATOR_HOST=127.0.0.1:8085` et `NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-nico-firestore`.

## Pages

- `/` : le carnet, rendu côté serveur avec les recettes déjà dans le HTML.
- `/recettes/<id>` : une page par recette, avec ses métadonnées de partage (Open Graph) et ses données structurées `Recipe`.
- `/sitemap.xml` et `/robots.txt` sont générés automatiquement. L’adresse publique vient de `NEXT_PUBLIC_SITE_URL`, ou à défaut du domaine de production Vercel.

## Favoris et liste de courses

Les favoris sont conservés dans le navigateur du visiteur. Dès qu’une recette est en favori, le bouton « Liste de courses » réunit les ingrédients des recettes favorites, regroupés par recette : on coche ce qu’on a déjà, et « Copier la liste » copie ce qui reste à acheter.

## Photos des recettes

Chaque recette peut avoir une photo `public/photos/<identifiant>.jpg` (900 × 600, paysage). Une recette sans photo affiche son émoji. Après avoir ajouté ou retiré une photo, lancez `npm run photos` pour mettre à jour la liste `lib/recipe-photos.ts`, puis commitez les deux.

## Base de données

Les recettes sont stockées dans **Cloud Firestore Standard**, collection `recipes`, base `(default)` du projet `lesrecettesdenico-51466`, région **Paris — europe-west9**. Le projet reste sur le forfait **Spark**, sans facturation activée.

Les neuf recettes Notion ont été importées avec leurs identifiants d’origine. Le site lit exclusivement Firestore : le fichier `lib/notion-recipes.ts` est conservé comme archive d’import, sans servir de données de secours à l’application. Aucune variable `DATABASE_URL` n’est nécessaire.

Les lectures passent par un cache serveur de 60 secondes, partagé par les pages et l’API, et invalidé après chaque écriture. La recherche et les favoris ne produisent pas de lectures Firestore supplémentaires. Le quota gratuit Standard inclut 1 Gio de stockage, 50 000 lectures et 20 000 écritures par jour ; sur Spark, un dépassement limite le service sans activer une facturation. Voir https://firebase.google.com/docs/firestore/quotas.

Les règles `firestore.rules` autorisent la lecture publique des recettes, et leur création, modification et suppression uniquement avec le compte Google vérifié `appcraft31@gmail.com`. Les textes sont bornés et la date de création est immuable.

Les propositions de la communauté (`recipeSubmissions`) sont limitées à **5 par compte Google et par 24 heures**. La limite est appliquée par les règles elles-mêmes, grâce au compteur `submissionLimits/<uid>` écrit dans la même opération : elle vaut donc aussi pour une écriture directe dans Firestore. Une proposition validée devient une recette et une proposition refusée est supprimée ; dans les deux cas elle disparaît de `recipeSubmissions`.

Après toute modification de `firestore.rules`, déployez les règles :

```bash
npx -y firebase-tools@latest deploy --only firestore --project lesrecettesdenico-51466
```

## Administration avec Google

La lecture du carnet est publique. Le serveur Vercel vérifie chaque jeton Firebase à partir des certificats publics Google, puis le transmet à Firestore, qui applique ses règles. Aucun compte de service ni clé privée n’est nécessaire.

L’administrateur est défini à un seul endroit : la fonction `isAdmin()` de `firestore.rules`. Pour le changer, modifiez cette adresse et redéployez les règles. L’ancienne variable `ADMIN_EMAILS` n’est plus lue et peut être retirée de Vercel.

Depuis le site, l’administrateur peut ajouter, modifier et supprimer une recette, cocher « Le choix de Nico » et valider ou refuser les propositions. Chaque recette peut porter une étiquette libre (par exemple `deNico`), affichée sur sa carte et proposée comme filtre dans le carnet.

1. Dans Firebase Authentication, activez le fournisseur **Google**.
2. Ajoutez `localhost` et votre domaine Vercel dans **Authorized domains**.
3. Dans Vercel, ajoutez les variables ci-dessous pour Production, Preview et Development. Les valeurs `NEXT_PUBLIC_FIREBASE_*` sont celles de l’application Web Firebase.

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
# Facultatif : active Firebase Analytics (avec consentement).
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=
# Facultatif : adresse publique du site, si elle diffère du domaine de production Vercel.
NEXT_PUBLIC_SITE_URL=
```

## Sécurité

Chaque page reçoit une `Content-Security-Policy` avec un nonce propre à la requête (`proxy.ts`) : seuls les scripts du site, et ceux qu’ils chargent eux-mêmes (connexion Google, Analytics), peuvent s’exécuter. Les autres en-têtes de sécurité sont dans `next.config.ts`.

## Déploiement

Connectez le dépôt GitHub à Vercel. La configuration utilise automatiquement Next.js et la commande `npm run build`.
