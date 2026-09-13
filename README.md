# Les recettes de Nico

Carnet de recettes construit avec Next.js et prêt à être déployé sur Vercel.

## Développement

```bash
npm install
npm run dev
```

## Base de données

Les recettes sont stockées dans une base Neon Postgres. Dans Vercel, ajoutez l’intégration Neon au projet : elle renseigne automatiquement `DATABASE_URL`.

Ensuite, appliquez la migration présente dans `drizzle-neon/` à la base Neon avant d’ajouter les premières recettes.

## Administration avec Google

La lecture du carnet est publique. Les ajouts et modifications sont réservés aux comptes Google listés dans `ADMIN_EMAILS`. Le serveur Vercel vérifie chaque jeton Firebase avant toute écriture.

1. Dans Firebase Authentication, activez le fournisseur **Google**.
2. Ajoutez `localhost` et votre domaine Vercel dans **Authorized domains**.
3. Dans Vercel, ajoutez les variables ci-dessous pour Production, Preview et Development. Les valeurs `NEXT_PUBLIC_*` sont celles de l’application Web Firebase ; `FIREBASE_ADMIN_SERVICE_ACCOUNT` est le JSON complet d’un compte de service et doit rester secret.

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
FIREBASE_ADMIN_SERVICE_ACCOUNT='{"type":"service_account", "project_id":"..."}'
ADMIN_EMAILS=votre-adresse-google@example.com
```

Ne placez jamais `FIREBASE_ADMIN_SERVICE_ACCOUNT` dans une variable commençant par `NEXT_PUBLIC_`.

## Déploiement

Connectez le dépôt GitHub à Vercel. La configuration utilise automatiquement Next.js et la commande `npm run build`.
