import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ArrowLeft } from "lucide-react";
import { RecipeCard } from "@/components/recipe-card";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { featuredFirst, groupOf, GROUPS } from "@/lib/recipe-browse";
import { getRecipes } from "@/lib/recipes-cache";
import { categoryPath, recipePath, sharingImage, siteName, siteUrl } from "@/lib/site";

type Props = { params: Promise<{ id: string }> };

/** What each page says of its moment, for visitors and search engines alike. */
const PAGES: Record<string, { title: string; intro: string }> = {
  "petit-dejeuner": { title: "Recettes de petit-déjeuner", intro: "Brioche, pancakes, porridge, tartines ou œufs : des idées sucrées et salées pour varier les matins de semaine comme les brunchs du week-end." },
  midi: { title: "Recettes pour le repas du midi", intro: "Salades complètes, tartes salées, sandwichs et bols : des déjeuners faits maison, simples à préparer." },
  soir: { title: "Recettes pour le repas du soir", intro: "Plats mijotés, gratins, pâtes et currys : de quoi répondre chaque soir à la question « qu’est-ce qu’on mange ? »." },
  enfants: { title: "Recettes pour faire aimer les légumes aux enfants", intro: "Galettes, nuggets, gratins et purées colorées : des légumes présentés autrement, pour que les enfants les goûtent avec plaisir." },
  desserts: { title: "Recettes de desserts et de gâteaux", intro: "Tartes, gâteaux moelleux, crèmes et biscuits : les classiques faits maison, du goûter au dessert du dimanche." },
  boissons: { title: "Recettes de boissons maison", intro: "Smoothies, citronnade, thé glacé ou chocolat chaud : des boissons maison pour toutes les saisons." },
  autres: { title: "Bases et autres recettes", intro: "Les pâtes de base et les préparations utiles à garder sous la main." },
};

async function findCategory({ params }: Props) {
  await connection();
  const { id } = await params;
  const group = GROUPS.find((candidate) => candidate.id === id);
  if (!group) return undefined;
  const all = await getRecipes();
  return { group, page: PAGES[group.id] ?? { title: group.label, intro: "" }, recipes: featuredFirst(all.filter((recipe) => groupOf(recipe) === group.id)) };
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const category = await findCategory(props).catch(() => undefined);
  if (!category) return { title: "Page introuvable" };
  const { group, page, recipes } = category;
  return {
    title: page.title,
    description: page.intro,
    alternates: { canonical: categoryPath(group.id) },
    // An empty moment has nothing to offer a search engine yet.
    ...(recipes.length ? {} : { robots: { index: false } }),
    // Next.js replaces the layout's openGraph as a whole, so the image is repeated here.
    openGraph: { type: "website", locale: "fr_FR", siteName, title: page.title, description: page.intro, url: categoryPath(group.id), images: [sharingImage] },
  };
}

export default async function CategoryPage(props: Props) {
  const category = await findCategory(props);
  if (!category) notFound();
  const { group, page, recipes } = category;
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [{
      "@type": "ItemList",
      name: page.title,
      itemListElement: recipes.map((recipe, index) => ({ "@type": "ListItem", position: index + 1, url: `${siteUrl}${recipePath(recipe.id)}` })),
    }, {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: siteName, item: siteUrl },
        { "@type": "ListItem", position: 2, name: group.label },
      ],
    }],
  };
  return <>
    <SiteHeader />
    <main id="top">
      <section className="category-page" aria-labelledby="category-title">
        <Link className="back-link" href="/#carnet"><ArrowLeft size={16} aria-hidden="true" /> Tout le carnet</Link>
        <p className="section-kicker">{group.label}</p>
        <h1 id="category-title">{page.title}<span className="title-dot">.</span></h1>
        {page.intro && <p className="recipe-page-description">{page.intro}</p>}
        <p className="results-count">{recipes.length} recette{recipes.length !== 1 ? "s" : ""}</p>
        <div className="recipes-grid recipes-list">{recipes.map((recipe) => <RecipeCard key={recipe.id} recipe={recipe} />)}</div>
      </section>
      {/* Recipe ids never contain "<"; escaped anyway. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
    </main>
    <SiteFooter />
  </>;
}
