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

## Déploiement

Connectez le dépôt GitHub à Vercel. La configuration utilise automatiquement Next.js et la commande `npm run build`.
