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

## Administration

La lecture du carnet est publique. Seul l’administrateur peut ajouter ou modifier une recette : les routes d’écriture vérifient une session signée côté serveur.

Ajoutez ces variables d’environnement dans Vercel (Production, Preview et Development) :

```bash
ADMIN_PASSWORD=un-mot-de-passe-long-et-unique
AUTH_SECRET=une-chaine-aleatoire-d-au-moins-32-caracteres
```

`AUTH_SECRET` doit rester secret et ne doit jamais être exposé dans une variable commençant par `NEXT_PUBLIC_`.

## Déploiement

Connectez le dépôt GitHub à Vercel. La configuration utilise automatiquement Next.js et la commande `npm run build`.
