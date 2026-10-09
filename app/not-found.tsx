import Link from "next/link";
import { connection } from "next/server";
import { SiteBrand } from "@/components/site-brand";

export default async function NotFound() {
  // Rendered per request so that its scripts receive the CSP nonce.
  await connection();
  return <>
    <header className="site-header"><SiteBrand href="/" /></header>
    <main id="top">
      <div className="empty-state not-found">
        <h1>Cette page n’est plus au menu.</h1>
        <p>La recette a peut-être été retirée du carnet, ou le lien est incomplet.</p>
        <Link className="primary-link" href="/#carnet">Voir toutes les recettes</Link>
      </div>
    </main>
  </>;
}
