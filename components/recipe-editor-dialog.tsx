"use client";

import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { authHeaders } from "@/lib/admin-api";
import type { Recipe } from "@/lib/notion-recipes";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The recipe being edited, or null to add a new one. */
  recipe: Recipe | null;
  categories: string[];
  onSaved: (recipe: Recipe, created: boolean) => void;
  onDeleted: (recipe: Recipe) => void;
};

export function RecipeEditorDialog({ open, onOpenChange, recipe, categories, onSaved, onDeleted }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  function changeOpen(nextOpen: boolean) {
    if (!nextOpen) { setError(""); setConfirmingDelete(false); }
    onOpenChange(nextOpen);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (field: string) => String(form.get(field) ?? "");
    if (!text("title").trim()) return;
    setBusy(true); setError("");
    const payload = { title: text("title"), category: text("category"), description: text("description"), duration: text("duration"), servings: text("servings"), ingredients: text("ingredients"), steps: text("steps"), contributor: text("contributor"), emoji: recipe?.emoji ?? "🍽️", featured: form.get("featured") === "on" };
    try {
      const response = await fetch("/api/recipes", { method: recipe ? "PATCH" : "POST", headers: { "Content-Type": "application/json", ...await authHeaders() }, body: JSON.stringify({ ...payload, ...(recipe ? { id: recipe.id } : {}) }) });
      const data = await response.json() as { recipe?: Recipe; error?: string };
      if (!response.ok || !data.recipe) throw new Error(data.error || "Impossible d’enregistrer cette recette pour le moment.");
      onSaved(data.recipe, !recipe);
      changeOpen(false);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Impossible d’enregistrer cette recette pour le moment."); }
    finally { setBusy(false); }
  }

  async function remove() {
    if (!recipe) return;
    if (!confirmingDelete) return setConfirmingDelete(true);
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/recipes?id=${encodeURIComponent(String(recipe.id))}`, { method: "DELETE", headers: await authHeaders() });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Impossible de supprimer cette recette pour le moment.");
      onDeleted(recipe);
      changeOpen(false);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Impossible de supprimer cette recette pour le moment."); }
    finally { setBusy(false); }
  }

  return <Dialog open={open} onOpenChange={changeOpen}>
    <DialogContent className="recipe-dialog">
      <DialogHeader>
        <p className="form-kicker">{recipe ? "Mise à jour" : "Ajout rapide"}</p>
        <DialogTitle>{recipe ? "Modifier la recette" : "Nouvelle recette"}</DialogTitle>
        <DialogDescription>{recipe ? "Modifiez uniquement ce dont vous avez besoin." : "Donnez-lui un nom pour l’enregistrer. Tout le reste peut être ajouté maintenant ou plus tard."}</DialogDescription>
      </DialogHeader>
      <form key={String(recipe?.id ?? "new")} onSubmit={save} className="recipe-form">
        <label className="recipe-title-field"><span>Nom de la recette <strong aria-hidden="true">*</strong></span><Input autoFocus required name="title" defaultValue={recipe?.title} placeholder="Ex. Gratin de courgettes" autoComplete="off" /><small>Seul champ obligatoire</small></label>
        <div className="recipe-main-fields">
          <label><span>Ingrédients <small>facultatif</small></span><Textarea name="ingredients" defaultValue={recipe?.ingredients} placeholder={"3 courgettes\n20 cl de crème\n100 g de fromage râpé"} aria-describedby="ingredients-help" /><small id="ingredients-help">Un ingrédient par ligne</small></label>
          <label><span>Préparation <small>facultatif</small></span><Textarea name="steps" defaultValue={recipe?.steps} placeholder={"Couper les courgettes.\nAjouter la crème.\nFaire gratiner 25 minutes."} aria-describedby="steps-help" /><small id="steps-help">Une étape par ligne</small></label>
        </div>
        <details className="optional-details" open={Boolean(recipe)}>
          <summary><span>Ajouter des détails</span><small>Catégorie, temps, portions et résumé</small></summary>
          <div className="optional-fields">
            <label>Catégorie<Input name="category" defaultValue={recipe?.category} placeholder="Ex. Plat" list="recipe-categories" autoComplete="off" /><datalist id="recipe-categories">{categories.map((category) => <option key={category} value={category} />)}</datalist></label>
            <div className="form-grid">
              <label>Temps total<Input name="duration" defaultValue={recipe?.duration === "À préciser" ? "" : recipe?.duration} placeholder="Ex. 45 min" /></label>
              <label>Portions<Input name="servings" defaultValue={recipe?.servings === "À préciser" ? "" : recipe?.servings} placeholder="Ex. 4 personnes" /></label>
            </div>
            <label>Petit résumé<Input name="description" defaultValue={recipe?.description === "Une recette à essayer." ? "" : recipe?.description} placeholder="Ce qui la rend spéciale" /></label>
            <label>Signature<Input name="contributor" maxLength={60} defaultValue={recipe?.contributor} placeholder="Ex. Nicolas" /></label>
            <label className="featured-field"><input type="checkbox" name="featured" defaultChecked={Boolean(recipe?.featured)} /><span>Le choix de Nico <small>mise en avant en tête du carnet</small></span></label>
          </div>
        </details>
        {error && <p className="form-error" role="alert">{error}</p>}
        <DialogFooter className="recipe-actions">
          {recipe && <Button type="button" variant="outline" className="delete-button" disabled={busy} onClick={remove}>{confirmingDelete ? "Confirmer la suppression" : "Supprimer"}</Button>}
          <DialogClose asChild><Button type="button" variant="outline" disabled={busy}>Annuler</Button></DialogClose>
          <Button type="submit" disabled={busy}>{busy ? "Enregistrement…" : recipe ? "Enregistrer" : "Ajouter au carnet"}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
