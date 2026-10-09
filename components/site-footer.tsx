"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ANALYTICS_SETTINGS_EVENT } from "@/lib/firebase-analytics";

export function SiteFooter({ children }: { children?: ReactNode }) {
  return <footer>
    <Link className="footer-brand" href="/">Les recettes de Nico.</Link>
    <p>Cuisiner, goûter, recommencer.</p>
    <button type="button" className="privacy-link" onClick={() => window.dispatchEvent(new Event(ANALYTICS_SETTINGS_EVENT))}>Confidentialité</button>
    {children}
    <a href="#top">Retour en haut ↑</a>
  </footer>;
}
