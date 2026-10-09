"use client";

import { useMemo, useSyncExternalStore } from "react";
import type { Recipe } from "@/lib/notion-recipes";

const STORAGE_KEY = "nico-favorites";
const CHANGE_EVENT = "nico-favorites-changed";

export const recipeKey = (recipe: Recipe) => String(recipe.sourceId ?? recipe.id);

let favoriteSnapshot = "[]";
function subscribeFavorites(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener(CHANGE_EVENT, listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener(CHANGE_EVENT, listener);
  };
}
function readFavorites() {
  try { favoriteSnapshot = localStorage.getItem(STORAGE_KEY) ?? "[]"; } catch { /* Use the current visit's favorites. */ }
  return favoriteSnapshot;
}

/** Favorites kept in this browser. `toggle` returns false when they could not be saved. */
export function useFavorites() {
  const favoriteData = useSyncExternalStore(subscribeFavorites, readFavorites, () => "[]");
  const favorites = useMemo<string[]>(() => {
    try {
      const stored: unknown = JSON.parse(favoriteData);
      return Array.isArray(stored) ? stored.filter((id): id is string => typeof id === "string") : [];
    } catch { return []; }
  }, [favoriteData]);
  function toggle(recipe: Recipe) {
    const key = recipeKey(recipe);
    favoriteSnapshot = JSON.stringify(favorites.includes(key) ? favorites.filter((id) => id !== key) : [...favorites, key]);
    let saved = true;
    try { localStorage.setItem(STORAGE_KEY, favoriteSnapshot); } catch { saved = false; }
    window.dispatchEvent(new Event(CHANGE_EVENT));
    return saved;
  }
  return { favorites, toggle };
}
