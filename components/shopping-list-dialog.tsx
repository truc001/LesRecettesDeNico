"use client";

import { useMemo, useState } from "react";
import { ShoppingBasket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { Recipe } from "@/lib/notion-recipes";
import { buildShoppingList, type ShoppingItem } from "@/lib/shopping-list";
import { recipeKey, useFavorites } from "@/lib/use-favorites";

const STORAGE_KEY = "nico-shopping-checked";

function readChecked(): string[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(stored) ? stored.filter((key): key is string => typeof key === "string") : [];
  } catch { return []; }
}

/**
 * Shopping list of the favorite recipes, with quantities added up. Ticked items
 * are remembered in this browser. Pages that do not hold the recipes leave
 * `recipes` out: they are fetched when the list is opened.
 */
export function ShoppingListDialog({ recipes }: { recipes?: Recipe[] }) {
  const { favorites } = useFavorites();
  const [fetched, setFetched] = useState<Recipe[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [checked, setChecked] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const known = recipes ?? fetched;
  const favoriteRecipes = useMemo(() => (known ?? []).filter((recipe) => favorites.includes(recipeKey(recipe))), [known, favorites]);
  const list = useMemo(() => buildShoppingList(favoriteRecipes), [favoriteRecipes]);
  const everything = [...list.items, ...list.extras];
  const remaining = everything.filter((item) => !checked.includes(item.key));

  function opened() {
    setChecked(readChecked()); setCopied(false);
    if (known || favorites.length === 0) return;
    setFailed(false);
    fetch("/api/recipes").then((response) => response.ok ? response.json() : Promise.reject())
      .then((data: { recipes: Recipe[] }) => setFetched(data.recipes)).catch(() => setFailed(true));
  }
  function save(next: string[]) {
    setChecked(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* The ticks still apply to the current visit. */ }
  }
  function toggle(key: string) { save(checked.includes(key) ? checked.filter((item) => item !== key) : [...checked, key]); }
  // What is left to buy, as plain text to paste into a note or a message.
  async function copy() {
    try { await navigator.clipboard.writeText(remaining.map((item) => `- ${item.label}`).join("\n")); setCopied(true); setTimeout(() => setCopied(false), 2500); }
    catch { setCopied(false); }
  }
  const rows = (items: ShoppingItem[]) => <ul>{items.map((item) => <li key={item.key}><label>
    <input type="checkbox" checked={checked.includes(item.key)} onChange={() => toggle(item.key)} />
    <span>{item.label}<small>{item.recipes.join(" · ")}</small></span>
  </label></li>)}</ul>;

  const description = favorites.length === 0 ? "Ajoutez un cœur aux recettes qui vous font envie : leurs ingrédients apparaîtront ici."
    : failed ? "Impossible de charger les recettes pour le moment. Réessayez dans un instant."
    : !known ? "Préparation de la liste…"
    : `Les ingrédients de vos ${favoriteRecipes.length} recette${favoriteRecipes.length !== 1 ? "s" : ""} en favoris, quantités additionnées. Cochez ce que vous avez déjà.`;

  return <Dialog onOpenChange={(open) => { if (open) opened(); }}>
    <DialogTrigger asChild><button className="nav-button"><ShoppingBasket size={16} aria-hidden="true" /> Liste de courses</button></DialogTrigger>
    <DialogContent className="shopping-dialog">
      <DialogHeader>
        <p className="form-kicker">Mes favoris</p>
        <DialogTitle>Liste de courses</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      {everything.length > 0 && <>
        <p className="shopping-count" role="status">{remaining.length === 0 ? "Tout est coché, bonnes courses !" : `${remaining.length} article${remaining.length !== 1 ? "s" : ""} à acheter sur ${everything.length}`}</p>
        <div className="shopping-list">
          {list.items.length > 0 && <section className="ingredients">{rows(list.items)}</section>}
          {list.extras.length > 0 && <section className="ingredients"><h3>À prévoir aussi</h3><p className="reading-hint">Sans quantité précise dans les recettes.</p>{rows(list.extras)}</section>}
        </div>
        <DialogFooter className="recipe-actions">
          <Button type="button" variant="outline" onClick={() => save([])} disabled={remaining.length === everything.length}>Tout décocher</Button>
          <Button type="button" onClick={copy} disabled={remaining.length === 0}>{copied ? "Liste copiée" : "Copier la liste"}</Button>
        </DialogFooter>
      </>}
    </DialogContent>
  </Dialog>;
}
