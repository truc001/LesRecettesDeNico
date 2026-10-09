"use client";

import { useEffect, useMemo, useState } from "react";
import { signInWithPopup, signOut } from "firebase/auth";
import { ArrowRight, ChefHat, Heart, LockKeyhole, Plus, Search, X } from "lucide-react";
import { AdminSignIn } from "@/components/admin-sign-in";
import { Hero } from "@/components/hero";
import { ModerationDialog } from "@/components/moderation-dialog";
import { RecipeCard } from "@/components/recipe-card";
import { RecipeEditorDialog } from "@/components/recipe-editor-dialog";
import { ShareRecipeDialog } from "@/components/share-recipe-dialog";
import { SiteBrand } from "@/components/site-brand";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import { authHeaders } from "@/lib/admin-api";
import { createGoogleProvider, getFirebaseAuth } from "@/lib/firebase-client";
import type { Recipe } from "@/lib/notion-recipes";
import { recipeKey, useFavorites } from "@/lib/use-favorites";
import { useSession } from "@/lib/use-session";

type ModelContext = { registerTool: (tool: { name: string; title: string; description: string; inputSchema: object; annotations: { readOnlyHint: boolean; untrustedContentHint: boolean }; execute: (input: unknown) => Promise<unknown> }, options: { signal: AbortSignal }) => void | Promise<void> };

const ALL = "Toutes";
const normalizeSearch = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export function Carnet({ initialRecipes, loadError }: { initialRecipes: Recipe[]; loadError: boolean }) {
  const [recipes, setRecipes] = useState(initialRecipes);
  const [activeCategory, setActiveCategory] = useState(ALL);
  const [activeTag, setActiveTag] = useState("");
  const [query, setQuery] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [notice, setNotice] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const { favorites, toggle: toggleFavorite } = useFavorites();
  const { currentUser, isAdmin, setIsAdmin } = useSession();

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
  const filteredRecipes = useMemo(() => {
    const search = normalizeSearch(query.trim());
    return recipes.filter((recipe) => (activeCategory === ALL || recipe.category === activeCategory)
      && (!activeTag || recipe.tag === activeTag)
      && (!favoritesOnly || favorites.includes(recipeKey(recipe)))
      && normalizeSearch(`${recipe.title} ${recipe.description} ${recipe.category} ${recipe.ingredients} ${recipe.contributor ?? ""} ${recipe.tag ?? ""}`).includes(search),
    ).sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)));
  }, [activeCategory, activeTag, query, recipes, favoritesOnly, favorites]);

  async function signInViewer() { await signInWithPopup(getFirebaseAuth(), createGoogleProvider()); }
  async function logOut() { try { await signOut(getFirebaseAuth()); } finally { setIsAdmin(false); } }
  function openEditor(recipe?: Recipe) { setEditingRecipe(recipe ?? null); setEditorOpen(true); }
  function likeRecipe(recipe: Recipe) {
    if (!toggleFavorite(recipe)) setNotice("Vos favoris sont disponibles pour cette visite. Le navigateur ne permet pas de les conserver.");
  }
  function recipeSaved(saved: Recipe, created: boolean) {
    setRecipes((current) => created ? [saved, ...current] : current.map((recipe) => recipe.id === saved.id ? { ...recipe, ...saved } : recipe));
    setNotice(created ? "Recette enregistrée dans votre carnet." : "Recette mise à jour.");
  }
  function recipeDeleted(deleted: Recipe) {
    setRecipes((current) => current.filter((recipe) => recipe.id !== deleted.id));
    setNotice(`« ${deleted.title} » a été retirée du carnet.`);
  }
  function showEverything() { setQuery(""); setActiveCategory(ALL); setActiveTag(""); setFavoritesOnly(false); }

  const resultsLabel = loadError ? "Le carnet est momentanément indisponible."
    : `${filteredRecipes.length} recette${filteredRecipes.length !== 1 ? "s" : ""}${favoritesOnly ? " dans vos favoris" : " à découvrir"}${query ? ` pour « ${query} »` : ""}`;

  return <>
    <a className="skip-link" href="#carnet">Aller aux recettes</a>
    <header className="site-header">
      <SiteBrand href="#top" />
      <nav className="main-nav" aria-label="Navigation principale">
        <a href="#carnet" onClick={() => setFavoritesOnly(false)}>Le carnet</a>
        <a href="#carnet" onClick={() => setFavoritesOnly(true)}><Heart size={16} aria-hidden="true" /> Mes favoris</a>
      </nav>
      <ShareRecipeDialog user={currentUser} categories={categories} onSignIn={signInViewer} />
      {isAdmin ? <div className="admin-controls"><span><LockKeyhole size={14} /> Administrateur</span><button onClick={logOut}>Quitter</button></div>
        : currentUser ? <div className="admin-controls viewer-controls"><span>Compte Google</span><button onClick={logOut}>Quitter</button></div>
        : <AdminSignIn onAdmin={() => setIsAdmin(true)} />}
      {isAdmin && <ModerationDialog onPublished={(recipe) => { setRecipes((current) => [recipe, ...current]); setNotice("La recette proposée est maintenant publiée."); }} />}
      {isAdmin && <Button className="add-button" onClick={() => openEditor()}><Plus size={18} /> Ajouter une recette</Button>}
    </header>
    {isAdmin && <RecipeEditorDialog open={editorOpen} onOpenChange={setEditorOpen} recipe={editingRecipe} categories={categories} tags={tags} onSaved={recipeSaved} onDeleted={recipeDeleted} />}
    <main id="top">
      <Hero recipeCount={loadError ? null : recipes.length} onExplore={() => setFavoritesOnly(false)} />
      <section className="cookbook" id="carnet" tabIndex={-1} aria-labelledby="collection-title">
        <div className="toolbar">
          <div>
            <p className="section-kicker">À garder sous la main</p>
            <h2 id="collection-title">{favoritesOnly ? "Mes favoris" : "Le carnet de recettes"}<span className="title-dot">.</span></h2>
            <p className="section-description">Une envie, un ingrédient… et si on passait en cuisine ?</p>
          </div>
          <div className="search-box">
            <Search size={20} aria-hidden="true" />
            <label className="sr-only" htmlFor="recipe-search">Rechercher une recette ou un ingrédient</label>
            <input id="recipe-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Une recette, un ingrédient…" />
            {query && <button aria-label="Effacer la recherche" onClick={() => setQuery("")}><X size={18} /></button>}
          </div>
        </div>
        <div className="collection-filters">
          <div className="filter-row" role="group" aria-label="Filtrer par catégorie">
            {[ALL, ...categories].map((category) => <button key={category} aria-pressed={activeCategory === category} onClick={() => setActiveCategory(category)} className={activeCategory === category ? "filter-active" : ""}>{category}<span>{category === ALL ? recipes.length : recipes.filter((recipe) => recipe.category === category).length}</span></button>)}
            {tags.map((tag) => <button key={`#${tag}`} aria-pressed={activeTag === tag} onClick={() => setActiveTag(activeTag === tag ? "" : tag)} className={`tag-filter ${activeTag === tag ? "filter-active" : ""}`}>#{tag}<span>{recipes.filter((recipe) => recipe.tag === tag).length}</span></button>)}
          </div>
          <button className={`favorites-filter ${favoritesOnly ? "filter-active" : ""}`} aria-pressed={favoritesOnly} onClick={() => setFavoritesOnly(!favoritesOnly)}><Heart size={17} aria-hidden="true" fill={favoritesOnly ? "currentColor" : "none"} /> Mes favoris</button>
        </div>
        <p className="results-count" role="status" aria-live="polite" aria-atomic="true">{resultsLabel}</p>
        {notice && <p className="notice" role="status">{notice}</p>}
        <div className="recipes-grid">
          {loadError && <div className="empty-state"><h3>Impossible de charger les recettes.</h3><p>Votre carnet reste enregistré. Réessayez dans un instant.</p><button className="primary-link" onClick={() => window.location.reload()}>Réessayer</button></div>}
          {filteredRecipes.map((recipe) => <RecipeCard key={recipe.id} recipe={recipe} liked={favorites.includes(recipeKey(recipe))} onLike={() => likeRecipe(recipe)} isAdmin={isAdmin} onEdit={openEditor} />)}
          {!loadError && !filteredRecipes.length && <div className="empty-state">
            <Search size={30} aria-hidden="true" />
            <h3>{favoritesOnly && !query ? "Vos prochaines envies commencent ici." : "Pas encore de recette par ici."}</h3>
            <p>{favoritesOnly ? "Ajoutez un cœur aux recettes qui vous font envie pour les retrouver ici." : "Essayez un autre ingrédient ou explorez toutes les catégories."}</p>
            <button className="primary-link" onClick={showEverything}>Voir toutes les recettes <ArrowRight size={18} aria-hidden="true" /></button>
          </div>}
          {isAdmin && <button className="add-card" onClick={() => openEditor()}><span><Plus size={25} aria-hidden="true" /></span><strong>La prochaine bonne idée</strong><small>Ajouter une recette au carnet</small></button>}
        </div>
      </section>
      <aside className="closing-note"><ChefHat size={30} aria-hidden="true" /><p>Les meilleures recettes sont celles <em>que l’on partage.</em></p><span>Faites avec envie. Gardées avec soin.</span></aside>
    </main>
    <SiteFooter homeHref="#top" />
  </>;
}
