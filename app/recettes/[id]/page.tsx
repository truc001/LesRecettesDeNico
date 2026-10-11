import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { FavoriteButton } from "@/components/favorite-button";
import { RecipeReading } from "@/components/recipe-reading";
import { RecipeViewTracker } from "@/components/recipe-view-tracker";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { groupOf, GROUPS, totalMinutes } from "@/lib/recipe-browse";
import { recipePhoto } from "@/lib/recipe-photos";
import { getRecipes } from "@/lib/recipes-cache";
import { categoryPath, recipePath, sharingImage, siteName, siteUrl } from "@/lib/site";

type Props = { params: Promise<{ id: string }> };

async function findRecipe({ params }: Props) {
  await connection();
  const { id } = await params;
  const recipes = await getRecipes();
  const index = recipes.findIndex((recipe) => String(recipe.id) === id);
  if (index === -1) return { recipe: undefined, similar: [] };
  const recipe = recipes[index];
  // Three recipes of the same moment: the ones that follow it in the carnet, so that pages do not all suggest the same.
  const moment = groupOf(recipe);
  const similar = [...recipes.slice(index + 1), ...recipes.slice(0, index)].filter((other) => groupOf(other) === moment).slice(0, 3);
  return { recipe, similar };
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const recipe = (await findRecipe(props).catch(() => undefined))?.recipe;
  if (!recipe) return { title: "Recette introuvable" };
  const photo = recipePhoto(recipe.id);
  return {
    title: recipe.title,
    description: recipe.description,
    alternates: { canonical: recipePath(recipe.id) },
    // Next.js replaces the layout's openGraph as a whole, so the image is repeated here.
    openGraph: { type: "article", locale: "fr_FR", siteName, title: recipe.title, description: recipe.description, url: recipePath(recipe.id), images: [photo ? { url: photo, width: 900, height: 600, alt: recipe.title } : sharingImage] },
  };
}

export default async function RecipePage(props: Props) {
  const { recipe, similar } = await findRecipe(props);
  if (!recipe) notFound();
  const moment = GROUPS.find((group) => group.id === groupOf(recipe))!;
  const photo = recipePhoto(recipe.id);
  const lines = (text: string) => text.split("\n").filter(Boolean);
  const minutes = totalMinutes(recipe.duration);
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [{
      "@type": "Recipe",
      name: recipe.title,
      description: recipe.description,
      url: `${siteUrl}${recipePath(recipe.id)}`,
      recipeCategory: recipe.category,
      keywords: [moment.label, ...(recipe.category === moment.label ? [] : [recipe.category]), ...(recipe.tag ? [recipe.tag] : [])].join(", "),
      ...(photo ? { image: `${siteUrl}${photo}` } : {}),
      author: { "@type": "Person", name: recipe.contributor || "Nico" },
      ...(recipe.createdAt ? { datePublished: recipe.createdAt } : {}),
      ...(minutes ? { totalTime: `PT${minutes}M` } : {}),
      ...(recipe.servings !== "À préciser" ? { recipeYield: recipe.servings } : {}),
      recipeIngredient: lines(recipe.ingredients),
      recipeInstructions: lines(recipe.steps).map((text) => ({ "@type": "HowToStep", text })),
    }, {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: siteName, item: siteUrl },
        { "@type": "ListItem", position: 2, name: moment.label, item: `${siteUrl}${categoryPath(moment.id)}` },
        { "@type": "ListItem", position: 3, name: recipe.title },
      ],
    }],
  };
  return <>
    <SiteHeader />
    <main id="top">
      <article className="recipe-page">
        <Link className="back-link" href={`/?moment=${moment.id}#carnet`}><ArrowLeft size={16} aria-hidden="true" /> {moment.label}</Link>
        <p className="section-kicker">{recipe.category}</p>
        <h1>{recipe.title}</h1>
        <p className="recipe-page-description">{recipe.description}</p>
        {recipe.contributor && <p className="recipe-contributor">Proposée par {recipe.contributor}</p>}
        {recipe.tag && <p className="recipe-tag">#{recipe.tag}</p>}
        <FavoriteButton recipe={{ id: recipe.id, sourceId: recipe.sourceId, title: recipe.title }} className="favorite-inline" withLabel />
        {photo && <div className="recipe-page-photo"><Image src={photo} alt={recipe.title} fill priority unoptimized sizes="(max-width: 900px) 100vw, 850px" /></div>}
        <RecipeReading recipe={recipe} />
      </article>
      {similar.length > 0 && <aside className="similar" aria-labelledby="similar-title">
        <h2 id="similar-title">Dans le même esprit<span className="title-dot">.</span></h2>
        <div className="similar-grid">{similar.map((other) => {
          const otherPhoto = recipePhoto(other.id);
          return <Link key={other.id} className="similar-card" href={recipePath(other.id)}>
            <span className="similar-photo">{otherPhoto ? <Image src={otherPhoto} alt="" fill unoptimized sizes="(max-width: 760px) 100vw, 280px" /> : <span aria-hidden="true">{other.emoji}</span>}</span>
            <strong>{other.title}</strong>
            <small>{other.duration === "À préciser" ? other.category : other.duration}</small>
          </Link>;
        })}</div>
        <Link className="see-all" href={categoryPath(moment.id)}>Toutes les recettes : {moment.label} <ArrowRight size={16} aria-hidden="true" /></Link>
      </aside>}
      <RecipeViewTracker id={String(recipe.id)} title={recipe.title} category={recipe.category} />
      {/* Recipe text never contains "<" (see lib/recipe-input.ts); escaped anyway. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
    </main>
    <SiteFooter />
  </>;
}
