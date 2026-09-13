# Les recettes de Nico

Carnet de recettes construit avec Next.js et prêt à être déployé sur Vercel.

## Développement

```bash
npm install
npm run dev
```

## Base de données

Les recettes sont stockées dans **Cloud Firestore Standard**, collection `recipes`, base `(default)` du projet `lesrecettesdenico-51466`, région **Paris — europe-west9**. Le projet reste sur le forfait **Spark**, sans facturation activée.

Les neuf recettes Notion ont été importées avec leurs identifiants d’origine. Le site lit exclusivement Firestore : le fichier `lib/notion-recipes.ts` est conservé comme archive d’import, sans servir de données de secours à l’application. Les anciens fichiers `db/` et `drizzle-neon/` sont historiques et ne sont plus utilisés par les routes du site. Aucune variable `DATABASE_URL` n’est nécessaire.

Les lectures passent par l’API Next.js avec un cache de 60 secondes, invalidé après chaque écriture. La recherche et les favoris ne produisent pas de lectures Firestore supplémentaires. Le quota gratuit Standard inclut 1 Gio de stockage, 50 000 lectures et 20 000 écritures par jour ; sur Spark, un dépassement limite le service sans activer une facturation. Voir https://firebase.google.com/docs/firestore/quotas.

Les règles `firestore.rules` autorisent la lecture publique des recettes et les créations/modifications uniquement avec le compte Google vérifié `appcraft31@gmail.com`. Les suppressions et les autres collections sont interdites. Les textes sont bornés et la date de création est immuable.

```bash
npx -y firebase-tools@latest deploy --only firestore --project lesrecettesdenico-51466
npx -y firebase-tools@latest emulators:exec --only firestore --project demo-nico-firestore "node tests/firestore-rules.cjs"
```

Le test utilise uniquement un projet de démonstration local. Il vérifie les accès publics, les écritures administrateur, les refus d’accès et la validation des données.

## Administration avec Google

La lecture du carnet est publique. Le serveur Vercel vérifie chaque jeton Firebase à partir des certificats publics Google et de `ADMIN_EMAILS`, puis transmet le jeton à Firestore, qui applique ses propres règles. Aucun compte de service ni clé privée n’est nécessaire. Pour changer l’administrateur, il faut modifier à la fois `ADMIN_EMAILS` et les règles Firestore.

1. Dans Firebase Authentication, activez le fournisseur **Google**.
2. Ajoutez `localhost` et votre domaine Vercel dans **Authorized domains**.
3. Dans Vercel, ajoutez les variables ci-dessous pour Production, Preview et Development. Les valeurs `NEXT_PUBLIC_*` sont celles de l’application Web Firebase.

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
ADMIN_EMAILS=votre-adresse-google@example.com
```

## Déploiement

Connectez le dépôt GitHub à Vercel. La configuration utilise automatiquement Next.js et la commande `npm run build`.
