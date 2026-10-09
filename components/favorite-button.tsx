"use client";

import { Heart } from "lucide-react";
import type { Recipe } from "@/lib/notion-recipes";
import { recipeKey, useFavorites } from "@/lib/use-favorites";

type Props = { recipe: Pick<Recipe, "id" | "sourceId" | "title">; className?: string; withLabel?: boolean; onUnsaved?: () => void };

/** Heart that adds the recipe to the favorites kept in this browser. */
export function FavoriteButton({ recipe, className = "favorite", withLabel = false, onUnsaved }: Props) {
  const { favorites, toggle } = useFavorites();
  const liked = favorites.includes(recipeKey(recipe as Recipe));
  const label = liked ? "Retirer des favoris" : "Ajouter aux favoris";
  return <button type="button" aria-label={withLabel ? undefined : `${label} : ${recipe.title}`} aria-pressed={liked} className={`${className} ${liked ? "favorite-active" : ""}`} onClick={() => { if (!toggle(recipe as Recipe)) onUnsaved?.(); }}>
    <Heart size={20} fill={liked ? "currentColor" : "none"} aria-hidden="true" />{withLabel && <span>{label}</span>}
  </button>;
}
