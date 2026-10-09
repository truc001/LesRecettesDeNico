"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, Shuffle } from "lucide-react";
import type { Recipe } from "@/lib/notion-recipes";
import { recipePhoto } from "@/lib/recipe-photos";
import { recipePath } from "@/lib/site";

type Props = {
  /** Every recipe, to draw "une idée au hasard" from. */
  recipes: Recipe[];
  /** Up to three recipes shown as a collage of photos. */
  highlights: Recipe[];
};

export function Hero({ recipes, highlights }: Props) {
  const router = useRouter();
  const pictured = highlights.flatMap((recipe) => { const photo = recipePhoto(recipe.id); return photo ? [{ recipe, photo }] : []; }).slice(0, 3);
  function surprise() {
    const recipe = recipes[Math.floor(Math.random() * recipes.length)];
    if (recipe) router.push(recipePath(recipe.id));
  }
  return <section className="hero" aria-labelledby="hero-title">
    <div className="hero-text">
      <p className="eyebrow"><span /> Le bonheur est fait maison</p>
      <h1 id="hero-title">Un peu de vous.<br />Beaucoup de <em>gourmandise.</em></h1>
      <p className="hero-copy">Les recettes qu’on aime faire, refaire et partager. Bienvenue dans mon carnet de cuisine.</p>
      {recipes.length > 0 && <div className="hero-actions">
        <button type="button" className="primary-link" onClick={surprise}><Shuffle size={18} aria-hidden="true" /> Une idée au hasard</button>
        <span className="hero-note"><BookOpen size={19} aria-hidden="true" />{recipes.length} recette{recipes.length !== 1 ? "s" : ""} à cuisiner, à votre rythme.</span>
      </div>}
    </div>
    {pictured.length > 0 && <div className="hero-collage">
      {pictured.map(({ recipe, photo }, index) => <Link key={recipe.id} className={`hero-tile hero-tile-${index + 1}`} href={recipePath(recipe.id)}>
        <Image src={photo} alt="" fill unoptimized priority={index === 0} sizes="(max-width: 760px) 60vw, 360px" />
        <span>{recipe.title}</span>
      </Link>)}
      <span className="photo-stamp" aria-hidden="true">Une pincée<br />de bonheur</span>
    </div>}
  </section>;
}
