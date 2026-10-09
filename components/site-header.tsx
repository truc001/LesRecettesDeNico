"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Heart } from "lucide-react";
import { ShoppingListDialog } from "@/components/shopping-list-dialog";
import { SiteBrand } from "@/components/site-brand";
import type { Recipe } from "@/lib/notion-recipes";
import { useFavorites } from "@/lib/use-favorites";

/** Header of every page: the carnet, the favorites and their shopping list are always one click away. */
export function SiteHeader({ recipes, children }: { recipes?: Recipe[]; children?: ReactNode }) {
  const { favorites } = useFavorites();
  return <header className="site-header">
    <SiteBrand href="/" />
    <nav className="main-nav" aria-label="Navigation principale">
      <Link href="/">Le carnet</Link>
      <Link href="/?favoris=1#carnet"><Heart size={16} aria-hidden="true" /> Mes favoris{favorites.length > 0 && <span className="nav-count" aria-label={`${favorites.length} recette${favorites.length !== 1 ? "s" : ""}`}>{favorites.length}</span>}</Link>
      <ShoppingListDialog recipes={recipes} />
    </nav>
    {children}
  </header>;
}
