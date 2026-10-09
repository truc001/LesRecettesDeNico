import { unstable_cache } from "next/cache";
import { listFirestoreRecipes } from "@/lib/firestore-recipes";

export const RECIPES_TAG = "recipes";

/** Every page and the API share this one cached Firestore listing. */
export const getRecipes = unstable_cache(listFirestoreRecipes, ["firestore-recipes-v1"], { revalidate: 60, tags: [RECIPES_TAG] });
