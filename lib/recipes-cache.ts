import { unstable_cache } from "next/cache";
import { listRecipes } from "@/lib/recipes-store";

export const RECIPES_TAG = "recipes";

/** Every page and the API share this one cached listing of the database. */
export const getRecipes = unstable_cache(listRecipes, ["neon-recipes-v1"], { revalidate: 60, tags: [RECIPES_TAG] });
