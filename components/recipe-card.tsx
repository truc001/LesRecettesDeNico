"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Clock3, Pencil, Sparkles, UsersRound } from "lucide-react";
import { FavoriteButton } from "@/components/favorite-button";
import type { Recipe } from "@/lib/notion-recipes";
import { recipePhoto } from "@/lib/recipe-photos";
import { recipePath } from "@/lib/site";

function cardTone(recipe: Recipe) {
  if (recipe.category === "Boisson") return "peach";
  if (recipe.category === "Pâte") return "sage";
  return recipe.title.toLowerCase().includes("citron") ? "lemon" : "sand";
}

type Props = {
  recipe: Recipe;
  isAdmin?: boolean;
  onEdit?: (recipe: Recipe) => void;
  onUnsavedFavorite?: () => void;
  /** Position in a grid that has just been filtered: the card enters a little after the previous one. */
  enterIndex?: number;
};

/** A recipe in a grid. The whole card opens the recipe page: its title link is stretched over it. */
export function RecipeCard({ recipe, isAdmin = false, onEdit, onUnsavedFavorite, enterIndex }: Props) {
  const photo = recipePhoto(recipe.id);
  const entering = enterIndex === undefined ? undefined : { animationDelay: `${Math.min(enterIndex, 11) * 55}ms` };
  return <article className={`recipe-card tone-${cardTone(recipe)} ${entering ? "recipe-card-entering" : ""}`} style={entering}>
    {/* Photos are already sized for the cards (900 px wide), so they are served as they are. */}
    {photo ? <div className="recipe-art recipe-photo"><Image src={photo} alt="" fill unoptimized sizes="(max-width: 480px) 100vw, (max-width: 1080px) 50vw, 400px" /></div>
      : <div className="recipe-art" aria-hidden="true"><span className="recipe-plate">{recipe.emoji}</span><span className="art-caption">Fait maison, avec plaisir</span></div>}
    <FavoriteButton recipe={recipe} onUnsaved={onUnsavedFavorite} />
    <div className="recipe-content">
      <div className="recipe-topline"><span>{recipe.category}</span>{recipe.featured && <span className="recipe-pick"><Sparkles size={12} aria-hidden="true" /> Le choix de Nico</span>}</div>
      <h3><Link className="card-link" href={recipePath(recipe.id)}>{recipe.title}</Link></h3>
      <p className="recipe-description">{recipe.description}</p>
      {recipe.contributor && <p className="recipe-contributor">Proposée par {recipe.contributor}</p>}
      {recipe.tag && <p className="recipe-tag">#{recipe.tag}</p>}
      <div className="recipe-meta">
        <span><Clock3 size={16} aria-hidden="true" /> {recipe.duration === "À préciser" ? "Temps à préciser" : recipe.duration}</span>
        {recipe.servings !== "À préciser" && <span><UsersRound size={16} aria-hidden="true" /> {recipe.servings}</span>}
      </div>
      <div className="recipe-card-bottom">
        <span className="recipe-link" aria-hidden="true">À vos fourneaux <ArrowRight className="recipe-arrow" size={18} /></span>
        {isAdmin && onEdit && <button aria-label={`Modifier ${recipe.title}`} className="edit-button" onClick={() => onEdit(recipe)}><Pencil size={18} /></button>}
      </div>
    </div>
  </article>;
}
