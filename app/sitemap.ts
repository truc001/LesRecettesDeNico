import type { MetadataRoute } from "next";
import { getRecipes } from "@/lib/recipes-cache";
import { groupOf, GROUPS } from "@/lib/recipe-browse";
import { categoryPath, recipePath, siteUrl } from "@/lib/site";

// Built per request from the cached recipe list, so new recipes appear without a redeploy.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // If Firestore is unreachable, the home page alone is still a valid sitemap.
  const recipes = await getRecipes().catch(() => []);
  // Recipes come newest first: a list changed last when its first recipe was added.
  const changed = (list: typeof recipes) => list[0]?.createdAt ? { lastModified: list[0].createdAt } : {};
  return [
    { url: siteUrl, changeFrequency: "weekly", priority: 1, ...changed(recipes) },
    ...GROUPS.flatMap((group) => {
      const inGroup = recipes.filter((recipe) => groupOf(recipe) === group.id);
      return inGroup.length ? [{ url: `${siteUrl}${categoryPath(group.id)}`, changeFrequency: "weekly" as const, priority: 0.8, ...changed(inGroup) }] : [];
    }),
    ...recipes.map((recipe) => ({ url: `${siteUrl}${recipePath(recipe.id)}`, changeFrequency: "monthly" as const, priority: 0.7, ...changed([recipe]) })),
  ];
}
