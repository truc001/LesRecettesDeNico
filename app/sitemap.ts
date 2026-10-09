import type { MetadataRoute } from "next";
import { getRecipes } from "@/lib/recipes-cache";
import { recipePath, siteUrl } from "@/lib/site";

// Built per request from the cached recipe list, so new recipes appear without a redeploy.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // If Firestore is unreachable, the home page alone is still a valid sitemap.
  const recipes = await getRecipes().catch(() => []);
  return [
    { url: siteUrl, changeFrequency: "weekly", priority: 1 },
    ...recipes.map((recipe) => ({ url: `${siteUrl}${recipePath(recipe.id)}`, changeFrequency: "monthly" as const, priority: 0.7 })),
  ];
}
