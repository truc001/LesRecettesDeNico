"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { BookOpen, Heart, Shuffle } from "lucide-react";
import { ShoppingListDialog } from "@/components/shopping-list-dialog";
import { SiteBrand } from "@/components/site-brand";
import type { Recipe } from "@/lib/notion-recipes";
import { recipePath } from "@/lib/site";
import { useFavorites } from "@/lib/use-favorites";

/**
 * Header of every page: the carnet, the favorites and their shopping list are
 * always one click away. On a phone the same destinations sit in a bar at the
 * bottom of the screen, within reach of the thumb.
 */
export function SiteHeader({ recipes, children }: { recipes?: Recipe[]; children?: ReactNode }) {
  const { favorites } = useFavorites();
  const router = useRouter();
  const onHome = usePathname() === "/";
  const favoritesOnly = useSearchParams().get("favoris") === "1";
  const onFavorites = onHome && favoritesOnly;
  const count = favorites.length > 0 && <span key={favorites.length} className="nav-count" aria-label={`${favorites.length} recette${favorites.length !== 1 ? "s" : ""}`}>{favorites.length}</span>;

  async function surprise() {
    try {
      const list = recipes ?? (await fetch("/api/recipes").then((response) => response.json()) as { recipes: Recipe[] }).recipes;
      const recipe = list[Math.floor(Math.random() * list.length)];
      if (recipe) router.push(recipePath(recipe.id));
    } catch { /* No network: nothing to draw from. */ }
  }

  return <>
    <header className="site-header">
      <SiteBrand href="/" />
      <nav className="main-nav" aria-label="Navigation principale">
        <Link href="/">Le carnet</Link>
        <Link href="/?favoris=1#carnet"><Heart size={16} aria-hidden="true" /> Mes favoris{count}</Link>
        <ShoppingListDialog recipes={recipes} />
      </nav>
      {children}
    </header>
    <nav className="tab-bar" aria-label="Navigation rapide">
      <Link className="tab-item" href="/" aria-current={onHome && !onFavorites ? "page" : undefined}><span><BookOpen size={21} aria-hidden="true" /></span>Carnet</Link>
      <Link className="tab-item" href="/?favoris=1#carnet" aria-current={onFavorites ? "page" : undefined}><span><Heart size={21} aria-hidden="true" /></span>Favoris{count}</Link>
      <ShoppingListDialog recipes={recipes} variant="tab" />
      <button type="button" className="tab-item" onClick={surprise}><span><Shuffle size={21} aria-hidden="true" /></span>Au hasard</button>
    </nav>
  </>;
}
