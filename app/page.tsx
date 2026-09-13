"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowUpRight, ChefHat, Clock3, Heart, Leaf, LockKeyhole, Pencil, Plus, Search, Sparkles, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createGoogleProvider, getFirebaseAuth } from "@/lib/firebase-client";
import { notionRecipes, type Recipe } from "@/lib/notion-recipes";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";

type ModelContext = { registerTool: (tool: { name: string; title: string; description: string; inputSchema: object; annotations: { readOnlyHint: boolean; untrustedContentHint: boolean }; execute: (input: unknown) => Promise<unknown> }, options: { signal: AbortSignal }) => void | Promise<void> };

function RecipeCard({ recipe, compact = false, isAdmin = false, onEdit }: { recipe: Recipe; compact?: boolean; isAdmin?: boolean; onEdit?: (recipe: Recipe) => void }) {
  const [liked, setLiked] = useState(false);
  return <article className={`recipe-card ${compact ? "recipe-card-compact" : ""}`}>
    <div className="recipe-symbol" aria-hidden="true">{recipe.emoji}</div>
    <div className="recipe-content"><div className="recipe-topline"><span>{recipe.category}</span><span className="recipe-actions">{isAdmin && <button aria-label={`Modifier ${recipe.title}`} className="edit-button" onClick={() => onEdit?.(recipe)}><Pencil size={15} /></button>}<button aria-label={liked ? "Retirer des favoris" : "Ajouter aux favoris"} className={`favorite ${liked ? "favorite-active" : ""}`} onClick={() => setLiked(!liked)}><Heart size={18} fill={liked ? "currentColor" : "none"} /></button></span></div><h3>{recipe.title}</h3><p>{recipe.description}</p><details className="recipe-details"><summary>Voir la recette</summary><h4>Ingrédients</h4><ul>{recipe.ingredients.split("\n").map((ingredient) => <li key={ingredient}>{ingredient}</li>)}</ul><h4>Préparation</h4><ol>{recipe.steps.split("\n").map((step) => <li key={step}>{step}</li>)}</ol></details><div className="recipe-meta"><span><Clock3 size={15} /> {recipe.duration}</span><span><UsersRound size={15} /> {recipe.servings}</span></div></div>
  </article>;
}

export default function Home() {
  const [activeCategory, setActiveCategory] = useState("Toutes");
  const [query, setQuery] = useState("");
  const [recipes, setRecipes] = useState<Recipe[]>(notionRecipes);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  useEffect(() => { fetch("/api/recipes").then((response) => response.ok ? response.json() : Promise.reject()).then((data: { recipes: Recipe[] }) => { if (data.recipes.length) setRecipes(data.recipes); }).catch(() => setNotice("Vos nouvelles recettes seront enregistrées dès que le carnet sera connecté.")); }, []);
  useEffect(() => {
    try {
      const auth = getFirebaseAuth();
      return onAuthStateChanged(auth, async (user) => {
        const token = user ? await user.getIdToken() : "";
        if (!token) return setIsAdmin(false);
        const response = await fetch("/api/auth/session", { headers: { Authorization: `Bearer ${token}` } });
        const data = await response.json() as { isAdmin?: boolean };
        setIsAdmin(Boolean(data.isAdmin));
      });
    } catch { setNotice("Firebase Authentication doit être configuré avant de pouvoir se connecter."); }
  }, []);
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
        const response = await fetch("/api/recipes", { method: "POST", headers: { "Content-Type": "application/json", ...await adminHeaders() }, body: JSON.stringify({ ...recipeInput, emoji: "🍽️" }) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Impossible d’enregistrer la recette.");
        setRecipes((current) => [data.recipe, ...current]);
        setNotice("Recette enregistrée dans votre carnet.");
        return { id: data.recipe.id, title: data.recipe.title, status: "enregistrée" };
      },
    }, { signal: lifecycle.signal })).catch(() => undefined);
    return () => lifecycle.abort();
  }, [isAdmin]);
  const categories = ["Toutes", ...Array.from(new Set(recipes.map((recipe) => recipe.category)))];
  const filteredRecipes = useMemo(() => recipes.filter((recipe) => { const inCategory = activeCategory === "Toutes" || recipe.category === activeCategory; return inCategory && `${recipe.title} ${recipe.description} ${recipe.category}`.toLowerCase().includes(query.trim().toLowerCase()); }), [activeCategory, query, recipes]);
  async function adminHeaders() {
    const token = await getFirebaseAuth().currentUser?.getIdToken();
    if (!token) { setIsAdmin(false); throw new Error("Session administrateur expirée. Reconnectez-vous."); }
    return { Authorization: `Bearer ${token}` };
  }
  async function logIn() {
    setLoggingIn(true); setLoginError("");
    try {
      const auth = getFirebaseAuth();
      const result = await signInWithPopup(auth, createGoogleProvider());
      const token = await result.user.getIdToken();
      const response = await fetch("/api/auth/session", { headers: { Authorization: `Bearer ${token}` } });
      const data = await response.json() as { isAdmin?: boolean };
      if (!data.isAdmin) { await signOut(auth); throw new Error("Ce compte Google n’est pas autorisé à administrer le carnet."); }
      setIsAdmin(true); setAuthOpen(false); setNotice("Connexion Google administrateur activée.");
    } catch (error) { setLoginError(error instanceof Error ? error.message : "Connexion Google impossible."); } finally { setLoggingIn(false); }
  }
  async function logOut() { try { await signOut(getFirebaseAuth()); } finally { setIsAdmin(false); setNotice("Connexion Google administrateur désactivée."); } }
  function openEditor(recipe?: Recipe) { setEditingRecipe(recipe ?? null); setDialogOpen(true); }
  async function saveRecipe(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); const title = String(form.get("title") || "").trim(); if (!title) return;
    setSaving(true); setNotice(""); const payload = { title, category: String(form.get("category") || "Mes recettes"), description: String(form.get("description") || "Une recette à essayer."), duration: String(form.get("duration") || "À préciser"), servings: String(form.get("servings") || "À préciser"), ingredients: String(form.get("ingredients") || ""), steps: String(form.get("steps") || ""), emoji: editingRecipe?.emoji ?? "🍽️" };
    try { const response = await fetch("/api/recipes", { method: editingRecipe ? "PATCH" : "POST", headers: { "Content-Type": "application/json", ...await adminHeaders() }, body: JSON.stringify({ ...payload, ...(editingRecipe ? { id: editingRecipe.id, sourceId: typeof editingRecipe.id === "string" ? editingRecipe.id : editingRecipe.sourceId } : {}) }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error); if (editingRecipe) setRecipes((current) => current.map((recipe) => recipe.id === editingRecipe.id || recipe.id === data.recipe.sourceId ? { ...recipe, ...data.recipe } : recipe)); else setRecipes((current) => [data.recipe, ...current]); setDialogOpen(false); setEditingRecipe(null); setNotice(editingRecipe ? "Recette mise à jour." : "Recette enregistrée dans votre carnet."); } catch (error) { setNotice(error instanceof Error ? error.message : "Impossible d’enregistrer cette recette pour le moment."); } finally { setSaving(false); }
  }
  const featured = recipes.find((recipe) => recipe.featured) ?? recipes[0];
  const regularRecipes = filteredRecipes.filter((recipe) => recipe.id !== featured?.id);
  return <main>
    <header className="site-header"><a className="brand" href="#top" aria-label="Les recettes de Nico, accueil"><span className="brand-mark"><ChefHat size={22} /></span><span>Les recettes<br /><em>de Nico</em></span></a><nav className="main-nav" aria-label="Navigation principale"><a className="nav-active" href="#carnet">Mon carnet</a><a href="#inspirations">Inspirations</a></nav>
      {isAdmin ? <div className="admin-controls"><span><LockKeyhole size={14} /> Administrateur</span><button onClick={logOut}>Quitter</button></div> : <Dialog open={authOpen} onOpenChange={setAuthOpen}><DialogTrigger asChild><button className="admin-login"><LockKeyhole size={15} /> Administration</button></DialogTrigger><DialogContent className="auth-dialog"><DialogHeader><DialogTitle>Administration</DialogTitle><DialogDescription>Connectez-vous avec le compte Google autorisé à gérer ce carnet.</DialogDescription></DialogHeader>{loginError && <p className="form-error" role="alert">{loginError}</p>}<DialogFooter><Button type="button" onClick={logIn} disabled={loggingIn}>{loggingIn ? "Connexion…" : "Continuer avec Google"}</Button></DialogFooter></DialogContent></Dialog>}
      {isAdmin && <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditingRecipe(null); }}><DialogTrigger asChild><Button className="add-button" onClick={() => openEditor()}><Plus size={18} /> Ajouter une recette</Button></DialogTrigger><DialogContent className="recipe-dialog"><DialogHeader><DialogTitle>{editingRecipe ? "Modifier la recette" : "Nouvelle recette"}</DialogTitle><DialogDescription>{editingRecipe ? "Vos modifications seront enregistrées dans votre carnet." : "Gardez l’essentiel maintenant, vous pourrez compléter la recette plus tard."}</DialogDescription></DialogHeader><form key={String(editingRecipe?.id ?? "new")} onSubmit={saveRecipe} className="recipe-form"><label>Nom de la recette<Input required name="title" defaultValue={editingRecipe?.title} placeholder="Ex. Gratin de courgettes" /></label><div className="form-grid"><label>Catégorie<Input name="category" defaultValue={editingRecipe?.category} placeholder="Ex. Plats" /></label><label>Temps total<Input name="duration" defaultValue={editingRecipe?.duration} placeholder="Ex. 45 min" /></label></div><div className="form-grid"><label>Portions<Input name="servings" defaultValue={editingRecipe?.servings} placeholder="Ex. 4 pers." /></label><label>Petit résumé<Input name="description" defaultValue={editingRecipe?.description} placeholder="Ce qui la rend spéciale" /></label></div><label>Ingrédients<Textarea name="ingredients" defaultValue={editingRecipe?.ingredients} placeholder="Un ingrédient par ligne" /></label><label>Préparation<Textarea name="steps" defaultValue={editingRecipe?.steps} placeholder="Les étapes, même en version brouillon" /></label><DialogFooter><Button type="submit" disabled={saving}>{saving ? "Enregistrement…" : editingRecipe ? "Enregistrer les modifications" : "Enregistrer la recette"}</Button></DialogFooter></form></DialogContent></Dialog>}</header>
    <section className="hero" id="top"><div><p className="eyebrow"><Sparkles size={15} /> Mon carnet gourmand</p><h1>Des recettes qui<br /><i>racontent</i> quelque chose.</h1><p className="hero-copy">Toutes vos idées, vos classiques et vos essais réussis, réunis dans un seul endroit.</p></div><aside className="season-card"><Leaf size={20} /><span>À la une</span><strong>Cuisine d’automne</strong><p>Des recettes simples pour les premiers soirs frais.</p><a href="#carnet">Voir la sélection <ArrowUpRight size={16} /></a></aside></section>
    <section className="cookbook" id="carnet"><div className="toolbar"><div><p className="section-kicker">Votre collection</p><h2>Mes recettes</h2></div><label className="search-box"><Search size={18} /><span className="sr-only">Rechercher une recette</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher" /></label></div><div className="filter-row" aria-label="Filtrer les recettes">{categories.map((category) => <button key={category} onClick={() => setActiveCategory(category)} className={activeCategory === category ? "filter-active" : ""}>{category}</button>)}</div>{notice && <p className="notice" role="status">{notice}</p>}
      {featured && (activeCategory === "Toutes" || activeCategory === featured.category) && !query && <section className="featured" aria-label="Recette mise en avant"><div className="featured-copy"><p className="section-kicker">La recette du moment</p><h2>Le plaisir des recettes<br />que l’on partage.</h2><p>Retrouvée dans votre Livre de recettes Notion : toutes les quantités et les étapes sont maintenant consultables dans votre carnet.</p><a className="text-link" href="#inspirations">Voir les recettes <ArrowUpRight size={17} /></a></div><RecipeCard recipe={featured} compact isAdmin={isAdmin} onEdit={openEditor} /></section>}
      <div className="recipes-grid" id="inspirations">{regularRecipes.map((recipe) => <RecipeCard key={recipe.id} recipe={recipe} isAdmin={isAdmin} onEdit={openEditor} />)}{!filteredRecipes.length && <p className="empty-state">Aucune recette ne correspond à votre recherche.</p>}{isAdmin && <button className="add-card" onClick={() => openEditor()}><span><Plus size={23} /></span><strong>Ajouter une recette</strong><small>Une idée à ne pas oublier ?</small></button>}</div>
    </section><footer>Les recettes de Nico <span>•</span> Cuisiner, goûter, recommencer.</footer>
  </main>;
}
