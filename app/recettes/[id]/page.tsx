import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ArrowLeft } from "lucide-react";
import { RecipeReading } from "@/components/recipe-reading";
import { SiteBrand } from "@/components/site-brand";
import { SiteFooter } from "@/components/site-footer";
import { getRecipes } from "@/lib/recipes-cache";
import { recipePath, sharingImage, siteName } from "@/lib/site";

type Props = { params: Promise<{ id: string }> };

async function findRecipe({ params }: Props) {
  await connection();
  const { id } = await params;
  return (await getRecipes()).find((recipe) => String(recipe.id) === id);
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const recipe = await findRecipe(props).catch(() => undefined);
  if (!recipe) return { title: "Recette introuvable" };
  return {
    title: recipe.title,
    description: recipe.description,
    alternates: { canonical: recipePath(recipe.id) },
    // Next.js replaces the layout's openGraph as a whole, so the image is repeated here.
    openGraph: { type: "article", locale: "fr_FR", siteName, title: recipe.title, description: recipe.description, url: recipePath(recipe.id), images: [sharingImage] },
  };
}

export default async function RecipePage(props: Props) {
  const recipe = await findRecipe(props);
  if (!recipe) notFound();
  const lines = (text: string) => text.split("\n").filter(Boolean);
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Recipe",
    name: recipe.title,
    description: recipe.description,
    recipeCategory: recipe.category,
    author: { "@type": "Person", name: recipe.contributor || "Nico" },
    ...(recipe.servings !== "À préciser" ? { recipeYield: recipe.servings } : {}),
    recipeIngredient: lines(recipe.ingredients),
    recipeInstructions: lines(recipe.steps).map((text) => ({ "@type": "HowToStep", text })),
  };
  return <>
    <header className="site-header"><SiteBrand href="/" /></header>
    <main id="top">
      <article className="recipe-page">
        <Link className="back-link" href="/#carnet"><ArrowLeft size={16} aria-hidden="true" /> Tout le carnet</Link>
        <p className="section-kicker">{recipe.category}</p>
        <h1>{recipe.title}</h1>
        <p className="recipe-page-description">{recipe.description}</p>
        {recipe.contributor && <p className="recipe-contributor">Proposée par {recipe.contributor}</p>}
        {recipe.tag && <p className="recipe-tag">#{recipe.tag}</p>}
        <RecipeReading recipe={recipe} />
      </article>
      {/* Recipe text never contains "<" (see lib/recipe-input.ts); escaped anyway. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
    </main>
    <SiteFooter homeHref="/" />
  </>;
}
