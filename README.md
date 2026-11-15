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
npm test                # tests unitaires, et accès à la base contre un Postgres en mémoire
```

`npm test` exécute le vrai code de `lib/` et le script de migration contre PGlite, un Postgres en mémoire chargé avec `db/schema.sql` : création, modification, suppression, contraintes du schéma, limite des propositions et modération. Aucune base réelle n’est touchée. Les mêmes commandes tournent dans GitHub Actions (`.github/workflows/ci.yml`).

Pour faire tourner le site en local, définissez `DATABASE_URL` avec la chaîne de connexion d’une branche Neon de développement, jamais celle de production.

## Pages

- `/` : le carnet, rendu côté serveur avec les recettes déjà dans le HTML. Sans filtre, il présente six recettes par moment (petit-déjeuner, midi, soir, enfants, desserts…) ; les filtres sont dans l’adresse (`/?moment=desserts&temps=30&q=citron`), si bien que le bouton retour les restaure et qu’une vue filtrée se partage par un lien. Les moments et le filtre de temps sont définis dans `lib/recipe-browse.ts`.
- `/recettes/<id>` : une page par recette, avec ses métadonnées de partage (Open Graph) et ses données structurées `Recipe` (durée totale, date de publication, fil d’Ariane).
- `/categories/<moment>` : une page par moment, qui liste toutes ses recettes. Son titre et son texte de présentation sont dans `app/categories/[id]/page.tsx` ; le pied de page y renvoie depuis tout le site.
- `/sitemap.xml` et `/robots.txt` sont générés automatiquement. L’adresse publique vient de `NEXT_PUBLIC_SITE_URL`, ou à défaut du domaine de production Vercel.

## Favoris et liste de courses

Les favoris sont conservés dans le navigateur du visiteur. Dès qu’une recette est en favori, le bouton « Liste de courses » réunit les ingrédients des recettes favorites en additionnant les quantités d’un même ingrédient (100 g + 150 g + 50 g de farine deviennent 300 g de farine). On coche ce qu’on a déjà, et « Copier la liste » copie ce qui reste à acheter.

Les ingrédients étant du texte libre, l’addition repose sur leur lecture (`lib/shopping-list.ts`) : une quantité, une unité éventuelle, puis le nom. Les unités d’une même famille sont converties (g et kg, cl et l, cuillères à café et à soupe) ; les autres restent côte à côte (« 250 g + 3 pots de farine »). Les lignes sans quantité (« Sel, poivre ») sont listées à part.

## Sur téléphone

En dessous de 760 px de large, le site change de forme plutôt que de se tasser : navigation dans une barre en bas de l’écran, un carrousel par moment sur l’accueil, résultats en lignes compactes, filtres dans un volet, recette en deux onglets, liste de courses en plein écran. Le bouton « Cuisiner pas à pas » ouvre le mode cuisine (`components/cooking-mode.tsx`) : une étape par écran, les ingrédients de l’étape, un minuteur quand elle demande d’attendre, et l’écran maintenu allumé là où le navigateur le permet.

Le site s’installe sur l’écran d’accueil (`app/manifest.ts`). Le service worker `public/sw.js` garde lisibles sans réseau les pages déjà visitées et les recettes mises en favori ; en ligne, le réseau passe toujours en premier, donc rien d’affiché n’est périmé.

## Photos des recettes

Chaque recette peut avoir une photo `public/photos/<identifiant>.jpg` (900 × 600, paysage). Une recette sans photo affiche son émoji. Après avoir ajouté, remplacé ou retiré une photo, lancez `npm run photos` : la commande crée la copie allégée servie aux téléphones (`public/photos/sm/`, 480 px) et met à jour la liste `lib/recipe-photos.ts`. Commitez le tout.

## Base de données

Les recettes sont stockées dans **Neon** (Postgres), projet `les-recettes-de-nico` à Francfort (`aws-eu-central-1`). Sa chaîne de connexion est la variable `DATABASE_URL`. Le schéma est dans `db/schema.sql` : tables `recipes`, `recipe_submissions` et `submission_limits`. Le site y accède par le pilote HTTP `@neondatabase/serverless` (`lib/db.ts`), avec des requêtes paramétrées.

Les lectures passent par un cache serveur de 60 secondes, partagé par les pages et l’API, et invalidé après chaque écriture. La recherche et les favoris ne produisent pas de lectures supplémentaires.

Le serveur valide chaque texte (`lib/recipe-input.ts`) et le schéma applique les mêmes bornes par des contraintes : longueurs maximales, pas de balises, de caractères de contrôle invisibles ni de protocole exécutable. Elles valent donc aussi pour une écriture directe en SQL.

Les propositions de la communauté sont limitées à **5 par compte Google et par 24 heures**. Le compteur `submission_limits` et la proposition sont écrits dans une seule instruction SQL, qui verrouille le compteur : deux envois simultanés ne peuvent pas dépasser la limite, et une proposition n’est jamais enregistrée sans être comptée. Une proposition validée devient une recette et une proposition refusée est supprimée ; dans les deux cas elle quitte `recipe_submissions`.

Après toute modification de `db/schema.sql`, appliquez-la avec `npm run db:migrate` (voir ci-dessous) : le schéma est idempotent.

Les neuf recettes Notion d’origine gardent leurs identifiants. Le fichier `lib/notion-recipes.ts` est conservé comme archive d’import, sans servir de données de secours.

### Bascule depuis Firestore

Jusqu’en novembre 2026, les recettes étaient dans Cloud Firestore (projet `lesrecettesdenico-51466`). `npm run db:migrate` (`tools/migrate-to-neon.mjs`) applique le schéma, copie toutes les recettes de Firestore dans Neon en gardant leurs identifiants et leurs dates, puis vérifie que chacune est identique des deux côtés. Les propositions en attente et leurs compteurs, privés, ne sont copiés qu’avec un jeton Google administrateur. Le script ne supprime jamais rien dans Firestore et peut être relancé : il met à jour ce qui a changé entre-temps.

```bash
# Ce qui serait copié, sans écrire dans Neon :
GOOGLE_ACCESS_TOKEN=$(gcloud auth print-access-token) npm run db:migrate -- --dry-run
# La copie :
DATABASE_URL='postgresql://…' GOOGLE_ACCESS_TOKEN=$(gcloud auth print-access-token) npm run db:migrate
```

Après la mise en production, Firestore n’est plus lu. Ses données restent en l’état comme sauvegarde ; `firestore.rules` et `firebase.json` décrivent encore cette base et pourront être retirés quand elle sera supprimée. Firebase reste utilisé pour la connexion Google.

## Administration avec Google

La lecture du carnet est publique. Le serveur Vercel vérifie chaque jeton Firebase à partir des certificats publics Google, puis n’autorise les écritures et la modération qu’au compte administrateur. Aucun compte de service ni clé privée n’est nécessaire.

L’administrateur est défini à un seul endroit : `ADMIN_EMAIL` dans `lib/admin.ts`. Pour le changer, modifiez cette adresse et redéployez le site. L’ancienne variable `ADMIN_EMAILS` n’est plus lue et peut être retirée de Vercel.

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
# Chaîne de connexion Neon.
DATABASE_URL=
# Facultatif : adresse publique du site, si elle diffère du domaine de production Vercel.
NEXT_PUBLIC_SITE_URL=
```

## Sécurité

Chaque page reçoit une `Content-Security-Policy` avec un nonce propre à la requête (`proxy.ts`) : seuls les scripts du site, et ceux qu’ils chargent eux-mêmes (connexion Google, Analytics), peuvent s’exécuter. Les autres en-têtes de sécurité sont dans `next.config.ts`.

## Déploiement

Connectez le dépôt GitHub à Vercel. La configuration utilise automatiquement Next.js et la commande `npm run build`.
