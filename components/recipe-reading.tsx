import { Clock3, UsersRound } from "lucide-react";
import type { Recipe } from "@/lib/notion-recipes";

const lines = (text: string) => text.split("\n").filter(Boolean);

/** Times, ingredients and steps of a recipe, shared by the dialog and the recipe page. */
export function RecipeReading({ recipe }: { recipe: Recipe }) {
  return <>
    <div className="reading-meta">
      <span><Clock3 size={18} aria-hidden="true" /> {recipe.duration === "À préciser" ? "Temps à préciser" : recipe.duration}</span>
      <span><UsersRound size={18} aria-hidden="true" /> {recipe.servings === "À préciser" ? "Portions à préciser" : recipe.servings}</span>
    </div>
    <div className="reading-columns">
      <section className="ingredients">
        <h3>Ingrédients</h3>
        <p className="reading-hint">Cochez au fur et à mesure.</p>
        <ul>{lines(recipe.ingredients).map((ingredient, index) => <li key={index}><label><input type="checkbox" /><span>{ingredient}</span></label></li>)}</ul>
      </section>
      <section className="preparation">
        <h3>Préparation</h3>
        <ol>{lines(recipe.steps).map((step, index) => <li key={index}>{step}</li>)}</ol>
      </section>
    </div>
  </>;
}
