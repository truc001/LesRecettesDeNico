"use client";

import Link from "next/link";
import { ArrowRight, Clock3, Heart, Pencil, Sparkles, UsersRound } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { RecipeReading } from "@/components/recipe-reading";
import { trackRecipeView } from "@/lib/firebase-analytics";
import type { Recipe } from "@/lib/notion-recipes";
import { recipePath } from "@/lib/site";

function cardTone(recipe: Recipe) {
  if (recipe.category === "Boisson") return "peach";
  if (recipe.category === "Pâte") return "sage";
  return recipe.title.toLowerCase().includes("citron") ? "lemon" : "sand";
}

export function RecipeCard({ recipe, liked, onLike, isAdmin, onEdit }: { recipe: Recipe; liked: boolean; onLike: () => void; isAdmin: boolean; onEdit: (recipe: Recipe) => void }) {
  return <article className={`recipe-card tone-${cardTone(recipe)}`}>
    <div className="recipe-art" aria-hidden="true"><span className="recipe-plate">{recipe.emoji}</span><span className="art-caption">Fait maison, avec plaisir</span></div>
    <button aria-label={`${liked ? "Retirer des favoris" : "Ajouter aux favoris"} : ${recipe.title}`} aria-pressed={liked} className={`favorite ${liked ? "favorite-active" : ""}`} onClick={onLike}><Heart size={20} fill={liked ? "currentColor" : "none"} /></button>
    <div className="recipe-content">
      <div className="recipe-topline"><span>{recipe.category}</span>{recipe.featured && <span className="recipe-pick"><Sparkles size={12} aria-hidden="true" /> Le choix de Nico</span>}</div>
      <h3><Link href={recipePath(recipe.id)}>{recipe.title}</Link></h3>
      <p className="recipe-description">{recipe.description}</p>
      {recipe.contributor && <p className="recipe-contributor">Proposée par {recipe.contributor}</p>}
      {recipe.tag && <p className="recipe-tag">#{recipe.tag}</p>}
      <div className="recipe-meta">
        <span><Clock3 size={16} aria-hidden="true" /> {recipe.duration === "À préciser" ? "Temps à préciser" : recipe.duration}</span>
        {recipe.servings !== "À préciser" && <span><UsersRound size={16} aria-hidden="true" /> {recipe.servings}</span>}
      </div>
      <div className="recipe-card-bottom">
        <Dialog onOpenChange={(open) => { if (open) void trackRecipeView(recipe); }}>
          <DialogTrigger asChild><button className="recipe-link" aria-label={`Voir la recette : ${recipe.title}`}>À vos fourneaux <ArrowRight size={18} aria-hidden="true" /></button></DialogTrigger>
          <DialogContent className="reading-dialog">
            <DialogHeader>
              <p className="section-kicker">{recipe.category}</p>
              <DialogTitle>{recipe.title}</DialogTitle>
              <DialogDescription>{recipe.description}{recipe.contributor ? ` — Proposée par ${recipe.contributor}.` : ""}</DialogDescription>
            </DialogHeader>
            <RecipeReading recipe={recipe} />
            <Link className="reading-permalink" href={recipePath(recipe.id)}>Ouvrir la page de la recette, pour la partager <ArrowRight size={16} aria-hidden="true" /></Link>
          </DialogContent>
        </Dialog>
        {isAdmin && <button aria-label={`Modifier ${recipe.title}`} className="edit-button" onClick={() => onEdit(recipe)}><Pencil size={18} /></button>}
      </div>
    </div>
  </article>;
}
