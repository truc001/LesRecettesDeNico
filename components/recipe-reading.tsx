"use client";

import { useRef, useState } from "react";
import { ArrowRight, Clock3, Play, RotateCcw, UsersRound } from "lucide-react";
import { CookingMode } from "@/components/cooking-mode";
import type { Recipe } from "@/lib/notion-recipes";

const lines = (text: string) => text.split("\n").filter(Boolean);

/** Times, ingredients and steps of a recipe. Ticked ingredients and the current step follow the cook, for this visit only. */
export function RecipeReading({ recipe }: { recipe: Recipe }) {
  const ingredients = lines(recipe.ingredients);
  const steps = lines(recipe.steps);
  const [checked, setChecked] = useState<number[]>([]);
  // -1 until the cook starts following the steps.
  const [current, setCurrent] = useState(-1);
  const stepList = useRef<HTMLOListElement>(null);
  // On a phone the two lists are tabs, and the steps can be followed full screen.
  const [tab, setTab] = useState<"ingredients" | "steps">("ingredients");
  const [cooking, setCooking] = useState(false);

  function toggle(index: number) { setChecked(checked.includes(index) ? checked.filter((item) => item !== index) : [...checked, index]); }
  function goTo(index: number) {
    setCurrent(index);
    stepList.current?.children[index]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
  const finished = current === steps.length - 1;

  return <>
    <div className="reading-meta">
      <span><Clock3 size={18} aria-hidden="true" /> {recipe.duration === "À préciser" ? "Temps à préciser" : recipe.duration}</span>
      <span><UsersRound size={18} aria-hidden="true" /> {recipe.servings === "À préciser" ? "Portions à préciser" : recipe.servings}</span>
    </div>
    <div className={`reading-tabs reading-tabs-${tab}`} role="group" aria-label="Partie de la recette">
      <button type="button" aria-pressed={tab === "ingredients"} onClick={() => setTab("ingredients")}>Ingrédients{checked.length > 0 && ` · ${checked.length}/${ingredients.length}`}</button>
      <button type="button" aria-pressed={tab === "steps"} onClick={() => setTab("steps")}>Préparation</button>
    </div>
    <div className="reading-columns" data-tab={tab}>
      <section className="ingredients">
        <h3>Ingrédients</h3>
        {ingredients.length > 0 && <div className="ingredients-progress">
          <span className="progress-track"><span style={{ width: `${checked.length / ingredients.length * 100}%` }} /></span>
          <span role="status">{checked.length} / {ingredients.length}</span>
        </div>}
        <ul>{ingredients.map((ingredient, index) => <li key={index}><label><input type="checkbox" checked={checked.includes(index)} onChange={() => toggle(index)} /><span>{ingredient}</span></label></li>)}</ul>
      </section>
      <section className="preparation">
        <h3>Préparation</h3>
        <ol ref={stepList}>{steps.map((step, index) => <li key={index} className={index === current ? "step-current" : index < current ? "step-done" : ""} aria-current={index === current ? "step" : undefined}>
          <button type="button" onClick={() => goTo(index)}>{step}</button>
        </li>)}</ol>
        {steps.length > 1 && <button type="button" className="step-next" onClick={() => goTo(finished ? 0 : current + 1)}>
          {current === -1 ? <>Suivre pas à pas <ArrowRight size={16} aria-hidden="true" /></> : finished ? <><RotateCcw size={16} aria-hidden="true" /> Revenir au début</> : <>Étape suivante <ArrowRight size={16} aria-hidden="true" /></>}
        </button>}
      </section>
    </div>
    {steps.length > 0 && <>
      <button type="button" className="cooking-start" onClick={() => setCooking(true)}><Play size={18} fill="currentColor" aria-hidden="true" /> Cuisiner pas à pas</button>
      <CookingMode title={recipe.title} ingredients={ingredients} steps={steps} open={cooking} onOpenChange={setCooking} />
    </>}
  </>;
}
