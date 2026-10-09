"use client";

import Link from "next/link";
import { ANALYTICS_SETTINGS_EVENT } from "@/lib/firebase-analytics";

export function SiteFooter({ homeHref }: { homeHref: string }) {
  return <footer>
    <Link className="footer-brand" href={homeHref}>Les recettes de Nico.</Link>
    <p>Cuisiner, goûter, recommencer.</p>
    <button type="button" className="privacy-link" onClick={() => window.dispatchEvent(new Event(ANALYTICS_SETTINGS_EVENT))}>Confidentialité</button>
    <a href="#top">Retour en haut ↑</a>
  </footer>;
}
