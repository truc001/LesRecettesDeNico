"use client";

import { useEffect } from "react";
import { trackRecipeView } from "@/lib/firebase-analytics";

/** Counts a view of the recipe page, when the visitor accepted audience measurement. */
export function RecipeViewTracker({ id, title, category }: { id: string; title: string; category: string }) {
  useEffect(() => { void trackRecipeView({ id, title, category }); }, [id, title, category]);
  return null;
}
