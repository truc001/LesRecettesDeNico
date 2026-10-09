"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { signInWithPopup, signOut } from "firebase/auth";
import { ArrowRight, ChefHat, LockKeyhole, Plus, Search, X } from "lucide-react";
import { AdminSignIn } from "@/components/admin-sign-in";
import { FilterSheet } from "@/components/filter-sheet";
import { Hero } from "@/components/hero";
import { ModerationDialog } from "@/components/moderation-dialog";
import { RecipeCard } from "@/components/recipe-card";
import { RecipeEditorDialog } from "@/components/recipe-editor-dialog";
import { ShareRecipeDialog } from "@/components/share-recipe-dialog";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { authHeaders } from "@/lib/admin-api";
import { createGoogleProvider, getFirebaseAuth } from "@/lib/firebase-client";
import type { Recipe } from "@/lib/notion-recipes";
import { featuredFirst, groupOf, GROUPS, matchesFilters, TIME_FILTERS } from "@/lib/recipe-browse";
import { useBrowseState } from "@/lib/use-browse-state";
import { recipeKey, useFavorites } from "@/lib/use-favorites";
import { useSession } from "@/lib/use-session";

type ModelContext = { registerTool: (tool: { name: string; title: string; description: string; inputSchema: object; annotations: { readOnlyHint: boolean; untrustedContentHint: boolean }; execute: (input: unknown) => Promise<unknown> }, options: { signal: AbortSignal }) => void | Promise<void> };

// Recipes shown per moment on the unfiltered home page, before "Tout voir".
const PREVIEW_SIZE = 6;

export function Carnet({ initialRecipes, loadError }: { initialRecipes: Recipe[]; loadError: boolean }) {
  const [recipes, setRecipes] = useState(initialRecipes);
  const [notice, setNotice] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const { favorites } = useFavorites();
  const { currentUser, isAdmin, setIsAdmin } = useSession();
  const browse = useBrowseState();
  const { group, time, query, tag, favoritesOnly } = browse;
  const searchInput = useRef<HTMLInputElement>(null);

  // The search box is not controlled, so that typing never waits for the address:
  // it only follows the address when it changes from elsewhere (back button, a link).
  useEffect(() => {
    const input = searchInput.current;
    if (input && input.value !== query && document.activeElement !== input) input.value = query;
  }, [query]);

  // Lets an in-browser assistant add a recipe on the administrator's behalf.
  useEffect(() => {
    const context = (document as Document & { modelContext?: ModelContext }).modelContext;
    if (!isAdmin || !context?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(context.registerTool({
      name: "add_recipe",
      title: "Ajouter une recette",
      description: "Enregistre une nouvelle recette dans le carnet quand les informations essentielles sont connues.",
      inputSchema: { type: "object", properties: { title: { type: "string" }, category: { type: "string" }, description: { type: "string" }, duration: { type: "string" }, servings: { type: "string" }, ingredients: { type: "string" }, steps: { type: "string" } }, required: ["title"], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      async execute(input) {
        const recipeInput = input as Partial<Omit<Recipe, "id" | "emoji">>;
        if (!recipeInput.title?.trim()) throw new Error("Le nom de la recette est requis.");
        const response = await fetch("/api/recipes", { method: "POST", headers: { "Content-Type": "application/json", ...await authHeaders() }, body: JSON.stringify({ ...recipeInput, emoji: "🍽️" }) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Impossible d’enregistrer la recette.");
        setRecipes((current) => [data.recipe, ...current]);
        setNotice("Recette enregistrée dans votre carnet.");
        return { id: data.recipe.id, title: data.recipe.title, status: "enregistrée" };
      },
    }, { signal: lifecycle.signal })).catch(() => undefined);
    return () => lifecycle.abort();
  }, [isAdmin]);

  const categories = useMemo(() => Array.from(new Set(recipes.map((recipe) => recipe.category))), [recipes]);
  const tags = useMemo(() => Array.from(new Set(recipes.flatMap((recipe) => recipe.tag ? [recipe.tag] : []))), [recipes]);
  // Moments that hold at least one recipe, in their fixed order.
  const moments = useMemo(() => GROUPS.map((moment) => ({ ...moment, recipes: featuredFirst(recipes.filter((recipe) => groupOf(recipe) === moment.id)) })).filter((moment) => moment.recipes.length > 0), [recipes]);
  // One photo per moment for the top of the page: "Le choix de Nico" first, then lunch and dinner.
  const highlights = useMemo(() => {
    const first = (id: string) => moments.find((moment) => moment.id === id)?.recipes[0];
    const picks = [recipes.find((recipe) => recipe.featured) ?? first("desserts"), first("soir"), first("petit-dejeuner")];
    return picks.filter((recipe): recipe is Recipe => Boolean(recipe));
  }, [recipes, moments]);
  const filteredRecipes = useMemo(() => featuredFirst(recipes.filter((recipe) => matchesFilters(recipe, { group, time, query, tag }) && (!favoritesOnly || favorites.includes(recipeKey(recipe))))),
    [recipes, group, time, query, tag, favoritesOnly, favorites]);

  async function signInViewer() { await signInWithPopup(getFirebaseAuth(), createGoogleProvider()); }
  async function logOut() { try { await signOut(getFirebaseAuth()); } finally { setIsAdmin(false); } }
  function openEditor(recipe?: Recipe) { setEditingRecipe(recipe ?? null); setEditorOpen(true); }
  function recipeSaved(saved: Recipe, created: boolean) {
    setRecipes((current) => created ? [saved, ...current] : current.map((recipe) => recipe.id === saved.id ? { ...recipe, ...saved } : recipe));
    setNotice(created ? "Recette enregistrée dans votre carnet." : "Recette mise à jour.");
  }
  function recipeDeleted(deleted: Recipe) {
    setRecipes((current) => current.filter((recipe) => recipe.id !== deleted.id));
    setNotice(`« ${deleted.title} » a été retirée du carnet.`);
  }
  function showEverything() {
    if (searchInput.current) searchInput.current.value = "";
    browse.reset();
  }
  function openMoment(id: string) {
    browse.update({ group: id });
    document.getElementById("carnet")?.scrollIntoView();
  }
  function clearSearch() {
    if (searchInput.current) { searchInput.current.value = ""; searchInput.current.focus(); }
    browse.update({ query: "" }, true);
  }

  const cardProps = { isAdmin, onEdit: openEditor, onUnsavedFavorite: () => setNotice("Vos favoris sont disponibles pour cette visite. Le navigateur ne permet pas de les conserver.") };
  const title = favoritesOnly ? "Mes favoris" : moments.find((moment) => moment.id === group)?.label ?? "Le carnet de recettes";
  const resultsLabel = `${filteredRecipes.length} recette${filteredRecipes.length !== 1 ? "s" : ""}${favoritesOnly ? " dans vos favoris" : ""}${query ? ` pour « ${query} »` : ""}`;

  return <>
    <a className="skip-link" href="#carnet">Aller aux recettes</a>
    <SiteHeader recipes={recipes}>
      <ShareRecipeDialog user={currentUser} categories={categories} onSignIn={signInViewer} />
      {isAdmin ? <div className="admin-controls"><span><LockKeyhole size={14} /> Administrateur</span><button onClick={logOut}>Quitter</button></div>
        : currentUser && <div className="admin-controls viewer-controls"><span>Compte Google</span><button onClick={logOut}>Quitter</button></div>}
      {isAdmin && <ModerationDialog onPublished={(recipe) => { setRecipes((current) => [recipe, ...current]); setNotice("La recette proposée est maintenant publiée."); }} />}
      {isAdmin && <Button className="add-button" onClick={() => openEditor()}><Plus size={18} /> Ajouter une recette</Button>}
    </SiteHeader>
    {isAdmin && <RecipeEditorDialog open={editorOpen} onOpenChange={setEditorOpen} recipe={editingRecipe} categories={categories} tags={tags} onSaved={recipeSaved} onDeleted={recipeDeleted} />}
    <main id="top">
      {!browse.active && <Hero recipes={recipes} highlights={highlights} />}
      <section className="cookbook" id="carnet" tabIndex={-1} aria-labelledby="collection-title">
        <div className="browse-bar">
          <div className="browse-search">
          <div className="search-box">
            <Search size={20} aria-hidden="true" />
            <label className="sr-only" htmlFor="recipe-search">Rechercher une recette ou un ingrédient</label>
            <input ref={searchInput} id="recipe-search" type="search" defaultValue={query} onChange={(event) => browse.update({ query: event.target.value }, true)} placeholder="Une recette, un ingrédient…" />
            {query && <button aria-label="Effacer la recherche" onClick={clearSearch}><X size={18} /></button>}
          </div>
          <FilterSheet state={{ group, time, query, tag, favoritesOnly }} moments={moments} tags={tags} resultCount={filteredRecipes.length} onChange={(patch) => browse.update(patch)} onClear={() => browse.update({ group: "", time: "", tag: "" })} />
          </div>
          <div className="filter-row" role="group" aria-label="Filtrer les recettes">
            <button aria-pressed={!group} onClick={() => browse.update({ group: "" })} className={!group ? "filter-active" : ""}>Tout<span>{recipes.length}</span></button>
            {moments.map((moment) => <button key={moment.id} aria-pressed={group === moment.id} onClick={() => browse.update({ group: group === moment.id ? "" : moment.id })} className={group === moment.id ? "filter-active" : ""}>{moment.chip}<span>{moment.recipes.length}</span></button>)}
            <span className="filter-separator" aria-hidden="true" />
            {TIME_FILTERS.map((option) => <button key={option.id} aria-pressed={time === option.id} onClick={() => browse.update({ time: time === option.id ? "" : option.id })} className={`time-filter ${time === option.id ? "filter-active" : ""}`}>{option.label}</button>)}
            {tags.map((name) => <button key={`#${name}`} aria-pressed={tag === name} onClick={() => browse.update({ tag: tag === name ? "" : name })} className={`tag-filter ${tag === name ? "filter-active" : ""}`}>#{name}</button>)}
          </div>
        </div>
        {notice && <p className="notice" role="status">{notice}</p>}
        {loadError && <div className="empty-state"><h3>Impossible de charger les recettes.</h3><p>Votre carnet reste enregistré. Réessayez dans un instant.</p><button className="primary-link" onClick={() => window.location.reload()}>Réessayer</button></div>}

        {!loadError && !browse.active && <>
          <h2 id="collection-title" className="sr-only">Le carnet de recettes</h2>
          {moments.map((moment) => <section key={moment.id} className="moment-section" aria-labelledby={`moment-${moment.id}`}>
            <div className="moment-heading">
              <h3 id={`moment-${moment.id}`}>{moment.label}<span className="title-dot">.</span></h3>
              {moment.recipes.length > PREVIEW_SIZE && <button className="see-all" onClick={() => openMoment(moment.id)}>Tout voir <span>{moment.recipes.length}</span> <ArrowRight size={16} aria-hidden="true" /></button>}
            </div>
            <div className="recipes-grid recipes-rail">{moment.recipes.slice(0, PREVIEW_SIZE).map((recipe) => <RecipeCard key={recipe.id} recipe={recipe} {...cardProps} />)}</div>
          </section>)}
          {isAdmin && <button className="add-card add-card-wide" onClick={() => openEditor()}><span><Plus size={25} aria-hidden="true" /></span><strong>La prochaine bonne idée</strong><small>Ajouter une recette au carnet</small></button>}
        </>}

        {!loadError && browse.active && <>
          <div className="results-heading">
            <h2 id="collection-title">{title}<span className="title-dot">.</span></h2>
            <button className="see-all" onClick={showEverything}><X size={16} aria-hidden="true" /> Tout le carnet</button>
          </div>
          <p className="results-count" role="status" aria-live="polite" aria-atomic="true">{resultsLabel}</p>
          {/* A new key per set of filters replays the cascade; typing in the search box does not. */}
          <div className="recipes-grid recipes-list" key={`${group}|${time}|${tag}|${favoritesOnly}`}>
            {filteredRecipes.map((recipe, index) => <RecipeCard key={recipe.id} recipe={recipe} enterIndex={index} {...cardProps} />)}
            {!filteredRecipes.length && <div className="empty-state">
              <Search size={30} aria-hidden="true" />
              <h3>{favoritesOnly && !query ? "Vos prochaines envies commencent ici." : "Pas encore de recette par ici."}</h3>
              <p>{favoritesOnly ? "Ajoutez un cœur aux recettes qui vous font envie pour les retrouver ici." : "Essayez un autre ingrédient ou retirez un filtre."}</p>
              <button className="primary-link" onClick={showEverything}>Voir toutes les recettes <ArrowRight size={18} aria-hidden="true" /></button>
            </div>}
          </div>
        </>}
      </section>
      <aside className="closing-note"><ChefHat size={30} aria-hidden="true" /><p>Les meilleures recettes sont celles <em>que l’on partage.</em></p><span>Faites avec envie. Gardées avec soin.</span></aside>
    </main>
    <SiteFooter>{!isAdmin && <AdminSignIn onAdmin={() => setIsAdmin(true)} />}</SiteFooter>
  </>;
}
