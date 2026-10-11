"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ANALYTICS_SETTINGS_EVENT } from "@/lib/firebase-analytics";
import { GROUPS } from "@/lib/recipe-browse";
import { categoryPath } from "@/lib/site";

export function SiteFooter({ children }: { children?: ReactNode }) {
  return <footer>
    {/* The named moments only: "Bases et autres" is a catch-all, left out. */}
    <nav className="footer-categories" aria-label="Recettes par moment">
      {GROUPS.filter((group) => group.categories.length > 0).map((group) => <Link key={group.id} href={categoryPath(group.id)}>{group.label}</Link>)}
    </nav>
    <Link className="footer-brand" href="/">Les recettes de Nico.</Link>
    <p>Cuisiner, goûter, recommencer.</p>
    <button type="button" className="privacy-link" onClick={() => window.dispatchEvent(new Event(ANALYTICS_SETTINGS_EVENT))}>Confidentialité</button>
    {children}
    <a href="#top">Retour en haut ↑</a>
  </footer>;
}
