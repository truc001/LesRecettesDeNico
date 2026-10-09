"use client";

import { useState } from "react";
import { ShoppingBasket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { Recipe } from "@/lib/notion-recipes";
import { recipeKey } from "@/lib/use-favorites";

const STORAGE_KEY = "nico-shopping-checked";
const ingredientsOf = (recipe: Recipe) => recipe.ingredients.split("\n").filter(Boolean);
const itemKey = (recipe: Recipe, ingredient: string) => `${recipeKey(recipe)}::${ingredient}`;

function readChecked(): string[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(stored) ? stored.filter((key): key is string => typeof key === "string") : [];
  } catch { return []; }
}

/** Shopping list built from the ingredients of the favorite recipes. Ticked items are remembered in this browser. */
export function ShoppingListDialog({ recipes }: { recipes: Recipe[] }) {
  const [checked, setChecked] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const listed = recipes.filter((recipe) => ingredientsOf(recipe).length > 0);
  const total = listed.reduce((count, recipe) => count + ingredientsOf(recipe).length, 0);
  const remaining = listed.reduce((count, recipe) => count + ingredientsOf(recipe).filter((ingredient) => !checked.includes(itemKey(recipe, ingredient))).length, 0);

  function save(next: string[]) {
    setChecked(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* The ticks still apply to the current visit. */ }
  }
  function toggle(key: string) { save(checked.includes(key) ? checked.filter((item) => item !== key) : [...checked, key]); }

  // What is left to buy, as plain text to paste into a note or a message.
  function remainingText() {
    return listed.flatMap((recipe) => {
      const items = ingredientsOf(recipe).filter((ingredient) => !checked.includes(itemKey(recipe, ingredient)));
      return items.length ? [`${recipe.title}${recipe.servings !== "À préciser" ? ` (${recipe.servings})` : ""}`, ...items.map((item) => `- ${item}`), ""] : [];
    }).join("\n").trim();
  }
  async function copy() {
    try { await navigator.clipboard.writeText(remainingText()); setCopied(true); setTimeout(() => setCopied(false), 2500); }
    catch { setCopied(false); }
  }

  return <Dialog onOpenChange={(open) => { if (open) { setChecked(readChecked()); setCopied(false); } }}>
    <DialogTrigger asChild><button className="favorites-filter shopping-button"><ShoppingBasket size={17} aria-hidden="true" /> Liste de courses</button></DialogTrigger>
    <DialogContent className="shopping-dialog">
      <DialogHeader>
        <p className="form-kicker">Mes favoris</p>
        <DialogTitle>Liste de courses</DialogTitle>
        <DialogDescription>{listed.length === 0 ? "Ajoutez un cœur aux recettes qui vous font envie : leurs ingrédients apparaîtront ici." : `Les ingrédients de vos ${listed.length} recette${listed.length !== 1 ? "s" : ""} en favoris. Cochez ce que vous avez déjà.`}</DialogDescription>
      </DialogHeader>
      {listed.length > 0 && <>
        <p className="shopping-count" role="status">{remaining === 0 ? "Tout est coché, bonnes courses !" : `${remaining} article${remaining !== 1 ? "s" : ""} à acheter sur ${total}`}</p>
        <div className="shopping-list">{listed.map((recipe) => <section key={recipe.id} className="ingredients">
          <h3>{recipe.title}</h3>
          {recipe.servings !== "À préciser" && <p className="reading-hint">Pour {recipe.servings.toLowerCase()}</p>}
          <ul>{ingredientsOf(recipe).map((ingredient, index) => {
            const key = itemKey(recipe, ingredient);
            return <li key={index}><label><input type="checkbox" checked={checked.includes(key)} onChange={() => toggle(key)} /><span>{ingredient}</span></label></li>;
          })}</ul>
        </section>)}</div>
        <DialogFooter className="recipe-actions">
          <Button type="button" variant="outline" onClick={() => save([])} disabled={remaining === total}>Tout décocher</Button>
          <Button type="button" onClick={copy} disabled={remaining === 0}>{copied ? "Liste copiée" : "Copier la liste"}</Button>
        </DialogFooter>
      </>}
    </DialogContent>
  </Dialog>;
}
