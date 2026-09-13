"use client";

import { FormEvent, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import { ArrowRight, BookOpen, ChefHat, Clock3, Heart, LockKeyhole, Pencil, Plus, Search, Sparkles, UsersRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createGoogleProvider, getFirebaseAuth } from "@/lib/firebase-client";
import { notionRecipes, type Recipe } from "@/lib/notion-recipes";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";

type ModelContext = { registerTool: (tool: { name: string; title: string; description: string; inputSchema: object; annotations: { readOnlyHint: boolean; untrustedContentHint: boolean }; execute: (input: unknown) => Promise<unknown> }, options: { signal: AbortSignal }) => void | Promise<void> };

function RecipeCard({ recipe, liked, onLike, isAdmin, onEdit }: { recipe: Recipe; liked: boolean; onLike: () => void; isAdmin: boolean; onEdit: (recipe: Recipe) => void }) {
  const tone = recipe.category === "Boisson" ? "peach" : recipe.category === "Pâte" ? "sage" : recipe.title.toLowerCase().includes("citron") ? "lemon" : "sand";
  return <article className={`recipe-card tone-${tone}`}>
    <div className="recipe-art" aria-hidden="true"><span className="recipe-plate">{recipe.emoji}</span><span className="art-caption">Fait maison, avec plaisir</span></div>
    <button aria-label={`${liked ? "Retirer des favoris" : "Ajouter aux favoris"} : ${recipe.title}`} aria-pressed={liked} className={`favorite ${liked ? "favorite-active" : ""}`} onClick={onLike}><Heart size={20} fill={liked ? "currentColor" : "none"} /></button>
    <div className="recipe-content">
      <div className="recipe-topline"><span>{recipe.category}</span>{recipe.featured && <span className="recipe-pick"><Sparkles size={12} aria-hidden="true" /> Le choix de Nico</span>}</div>
      <h3>{recipe.title}</h3><p className="recipe-description">{recipe.description}</p>
      <div className="recipe-meta"><span><Clock3 size={16} aria-hidden="true" /> {recipe.duration === "À préciser" ? "Temps à préciser" : recipe.duration}</span>{recipe.servings !== "À préciser" && <span><UsersRound size={16} aria-hidden="true" /> {recipe.servings}</span>}</div>
      <div className="recipe-card-bottom"><Dialog><DialogTrigger asChild><button className="recipe-link" aria-label={`Voir la recette : ${recipe.title}`}>À vos fourneaux <ArrowRight size={18} aria-hidden="true" /></button></DialogTrigger>
        <DialogContent className="reading-dialog"><DialogHeader><p className="section-kicker">{recipe.category}</p><DialogTitle>{recipe.title}</DialogTitle><DialogDescription>{recipe.description}</DialogDescription></DialogHeader>
          <div className="reading-meta"><span><Clock3 size={18} aria-hidden="true" /> {recipe.duration === "À préciser" ? "Temps à préciser" : recipe.duration}</span><span><UsersRound size={18} aria-hidden="true" /> {recipe.servings === "À préciser" ? "Portions à préciser" : recipe.servings}</span></div>
          <div className="reading-columns"><section className="ingredients"><h3>Ingrédients</h3><p className="reading-hint">Cochez au fur et à mesure.</p><ul>{recipe.ingredients.split("\n").filter(Boolean).map((ingredient, index) => <li key={index}><label><input type="checkbox" /><span>{ingredient}</span></label></li>)}</ul></section><section className="preparation"><h3>Préparation</h3><ol>{recipe.steps.split("\n").filter(Boolean).map((step, index) => <li key={index}>{step}</li>)}</ol></section></div>
        </DialogContent></Dialog>{isAdmin && <button aria-label={`Modifier ${recipe.title}`} className="edit-button" onClick={() => onEdit(recipe)}><Pencil size={18} /></button>}</div>
    </div>
  </article>;
}

const normalizeSearch = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const recipeKey = (recipe: Recipe) => String(recipe.sourceId ?? recipe.id);
let favoriteSnapshot = "[]";
function subscribeFavorites(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener("nico-favorites-changed", listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener("nico-favorites-changed", listener);
  };
}
function readFavorites() {
  try { favoriteSnapshot = localStorage.getItem("nico-favorites") ?? "[]"; } catch { /* Use the current visit's favorites. */ }
  return favoriteSnapshot;
}

export default function Home() {
  const [activeCategory, setActiveCategory] = useState("Toutes");
  const [query, setQuery] = useState("");
  const favoriteData = useSyncExternalStore(subscribeFavorites, readFavorites, () => "[]");
  const favorites = useMemo<string[]>(() => {
    try {
      const stored: unknown = JSON.parse(favoriteData);
      return Array.isArray(stored) ? stored.filter((id): id is string => typeof id === "string") : [];
    } catch { return []; }
  }, [favoriteData]);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [recipes, setRecipes] = useState<Recipe[]>(notionRecipes);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  function toggleFavorite(recipe: Recipe) {
    const key = recipeKey(recipe);
    const next = favorites.includes(key) ? favorites.filter((id) => id !== key) : [...favorites, key];
    favoriteSnapshot = JSON.stringify(next);
    try { localStorage.setItem("nico-favorites", favoriteSnapshot); } catch { setNotice("Vos favoris sont disponibles pour cette visite. Le navigateur ne permet pas de les conserver."); }
    window.dispatchEvent(new Event("nico-favorites-changed"));
  }
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
    } catch { /* The sign-in action reports any configuration error in its dialog. */ }
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
  const filteredRecipes = useMemo(() => recipes.filter((recipe) => {
    const inCategory = activeCategory === "Toutes" || recipe.category === activeCategory;
    return inCategory && (!favoritesOnly || favorites.includes(recipeKey(recipe))) && normalizeSearch(`${recipe.title} ${recipe.description} ${recipe.category} ${recipe.ingredients}`).includes(normalizeSearch(query.trim()));
  }).sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured))), [activeCategory, query, recipes, favoritesOnly, favorites]);
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
      setIsAdmin(true); setAuthOpen(false);
    } catch (error) { setLoginError(error instanceof Error ? error.message : "Connexion Google impossible."); } finally { setLoggingIn(false); }
  }
  async function logOut() { try { await signOut(getFirebaseAuth()); } finally { setIsAdmin(false); } }
  function openEditor(recipe?: Recipe) { setEditingRecipe(recipe ?? null); setDialogOpen(true); }
  async function saveRecipe(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); const title = String(form.get("title") || "").trim(); if (!title) return;
    setSaving(true); setNotice(""); const payload = { title, category: String(form.get("category") || "Mes recettes"), description: String(form.get("description") || "Une recette à essayer."), duration: String(form.get("duration") || "À préciser"), servings: String(form.get("servings") || "À préciser"), ingredients: String(form.get("ingredients") || ""), steps: String(form.get("steps") || ""), emoji: editingRecipe?.emoji ?? "🍽️" };
    try { const response = await fetch("/api/recipes", { method: editingRecipe ? "PATCH" : "POST", headers: { "Content-Type": "application/json", ...await adminHeaders() }, body: JSON.stringify({ ...payload, ...(editingRecipe ? { id: editingRecipe.id, sourceId: typeof editingRecipe.id === "string" ? editingRecipe.id : editingRecipe.sourceId } : {}) }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error); if (editingRecipe) setRecipes((current) => current.map((recipe) => recipe.id === editingRecipe.id || recipe.id === data.recipe.sourceId ? { ...recipe, ...data.recipe } : recipe)); else setRecipes((current) => [data.recipe, ...current]); setDialogOpen(false); setEditingRecipe(null); setNotice(editingRecipe ? "Recette mise à jour." : "Recette enregistrée dans votre carnet."); } catch (error) { setNotice(error instanceof Error ? error.message : "Impossible d’enregistrer cette recette pour le moment."); } finally { setSaving(false); }
  }
  return <>
    <a className="skip-link" href="#carnet">Aller aux recettes</a>
    <header className="site-header"><a className="brand" href="#top" aria-label="Les recettes de Nico, accueil"><span className="brand-mark"><ChefHat size={25} aria-hidden="true" /></span><span>Les recettes <strong>de Nico<span className="brand-dot">.</span></strong></span></a><nav className="main-nav" aria-label="Navigation principale"><a href="#carnet" onClick={() => setFavoritesOnly(false)}>Le carnet</a><a href="#carnet" onClick={() => setFavoritesOnly(true)}><Heart size={16} aria-hidden="true" /> Mes favoris</a></nav>
      {isAdmin ? <div className="admin-controls"><span><LockKeyhole size={14} /> Administrateur</span><button onClick={logOut}>Quitter</button></div> : <Dialog open={authOpen} onOpenChange={setAuthOpen}><DialogTrigger asChild><button className="admin-login"><LockKeyhole size={15} /> Administration</button></DialogTrigger><DialogContent className="auth-dialog"><DialogHeader><DialogTitle>Administration</DialogTitle><DialogDescription>Connectez-vous avec le compte Google autorisé à gérer ce carnet.</DialogDescription></DialogHeader>{loginError && <p className="form-error" role="alert">{loginError}</p>}<DialogFooter><Button type="button" onClick={logIn} disabled={loggingIn}>{loggingIn ? "Connexion…" : "Continuer avec Google"}</Button></DialogFooter></DialogContent></Dialog>}
      {isAdmin && <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditingRecipe(null); }}><DialogTrigger asChild><Button className="add-button" onClick={() => openEditor()}><Plus size={18} /> Ajouter une recette</Button></DialogTrigger><DialogContent className="recipe-dialog"><DialogHeader><DialogTitle>{editingRecipe ? "Modifier la recette" : "Nouvelle recette"}</DialogTitle><DialogDescription>{editingRecipe ? "Vos modifications seront enregistrées dans votre carnet." : "Gardez l’essentiel maintenant, vous pourrez compléter la recette plus tard."}</DialogDescription></DialogHeader><form key={String(editingRecipe?.id ?? "new")} onSubmit={saveRecipe} className="recipe-form"><label>Nom de la recette<Input required name="title" defaultValue={editingRecipe?.title} placeholder="Ex. Gratin de courgettes" /></label><div className="form-grid"><label>Catégorie<Input name="category" defaultValue={editingRecipe?.category} placeholder="Ex. Plats" /></label><label>Temps total<Input name="duration" defaultValue={editingRecipe?.duration} placeholder="Ex. 45 min" /></label></div><div className="form-grid"><label>Portions<Input name="servings" defaultValue={editingRecipe?.servings} placeholder="Ex. 4 pers." /></label><label>Petit résumé<Input name="description" defaultValue={editingRecipe?.description} placeholder="Ce qui la rend spéciale" /></label></div><label>Ingrédients<Textarea name="ingredients" defaultValue={editingRecipe?.ingredients} placeholder="Un ingrédient par ligne" /></label><label>Préparation<Textarea name="steps" defaultValue={editingRecipe?.steps} placeholder="Les étapes, même en version brouillon" /></label><DialogFooter><Button type="submit" disabled={saving}>{saving ? "Enregistrement…" : editingRecipe ? "Enregistrer les modifications" : "Enregistrer la recette"}</Button></DialogFooter></form></DialogContent></Dialog>}</header>
    <main id="top"><section className="hero" aria-labelledby="hero-title"><div className="hero-text"><p className="eyebrow"><span /> Le bonheur est fait maison</p><h1 id="hero-title">Un peu de vous.<br />Beaucoup de <em>gourmandise.</em></h1><p className="hero-copy">Les recettes qu’on aime faire, refaire et partager. Bienvenue dans mon carnet de cuisine.</p><a className="primary-link" href="#carnet" onClick={() => setFavoritesOnly(false)}>Explorer les recettes <ArrowRight size={19} aria-hidden="true" /></a><div className="hero-note"><BookOpen size={19} aria-hidden="true" /><span>{recipes.length} recettes à cuisiner, à votre rythme.</span></div></div><div className="hero-visual"><div className="hero-photo"><Image src="/tarte-tatin.png" alt="Tarte aux pommes caramélisées, tout juste servie à table" fill priority sizes="(max-width: 760px) 100vw, 50vw" /></div><div className="photo-note"><ChefHat size={25} aria-hidden="true" /><div><strong>Simplement bon.</strong><span>Le plaisir de cuisiner maison.</span></div></div><span className="photo-stamp" aria-hidden="true">Une pincée<br />de bonheur</span></div></section>
    <section className="cookbook" id="carnet" tabIndex={-1} aria-labelledby="collection-title"><div className="toolbar"><div><p className="section-kicker">À garder sous la main</p><h2 id="collection-title">{favoritesOnly ? "Mes favoris" : "Le carnet de recettes"}<span className="title-dot">.</span></h2><p className="section-description">Une envie, un ingrédient… et si on passait en cuisine ?</p></div><div className="search-box"><Search size={20} aria-hidden="true" /><label className="sr-only" htmlFor="recipe-search">Rechercher une recette ou un ingrédient</label><input id="recipe-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Une recette, un ingrédient…" />{query && <button aria-label="Effacer la recherche" onClick={() => setQuery("")}><X size={18} /></button>}</div></div>
      <div className="collection-filters"><div className="filter-row" role="group" aria-label="Filtrer par catégorie">{categories.map((category) => <button key={category} aria-pressed={activeCategory === category} onClick={() => setActiveCategory(category)} className={activeCategory === category ? "filter-active" : ""}>{category}<span>{category === "Toutes" ? recipes.length : recipes.filter((recipe) => recipe.category === category).length}</span></button>)}</div><button className={`favorites-filter ${favoritesOnly ? "filter-active" : ""}`} aria-pressed={favoritesOnly} onClick={() => setFavoritesOnly(!favoritesOnly)}><Heart size={17} aria-hidden="true" fill={favoritesOnly ? "currentColor" : "none"} /> Mes favoris</button></div>
      <p className="results-count" role="status" aria-live="polite" aria-atomic="true">{filteredRecipes.length} recette{filteredRecipes.length !== 1 ? "s" : ""}{favoritesOnly ? " dans vos favoris" : " à découvrir"}{query ? ` pour « ${query} »` : ""}</p>{notice && <p className="notice" role="status">{notice}</p>}
      <div className="recipes-grid">{filteredRecipes.map((recipe) => <RecipeCard key={recipe.id} recipe={recipe} liked={favorites.includes(recipeKey(recipe))} onLike={() => toggleFavorite(recipe)} isAdmin={isAdmin} onEdit={openEditor} />)}{!filteredRecipes.length && <div className="empty-state"><Search size={30} aria-hidden="true" /><h3>{favoritesOnly && !query ? "Vos prochaines envies commencent ici." : "Pas encore de recette par ici."}</h3><p>{favoritesOnly ? "Ajoutez un cœur aux recettes qui vous font envie pour les retrouver ici." : "Essayez un autre ingrédient ou explorez toutes les catégories."}</p><button className="primary-link" onClick={() => { setQuery(""); setActiveCategory("Toutes"); setFavoritesOnly(false); }}>Voir toutes les recettes <ArrowRight size={18} aria-hidden="true" /></button></div>}{isAdmin && <button className="add-card" onClick={() => openEditor()}><span><Plus size={25} aria-hidden="true" /></span><strong>La prochaine bonne idée</strong><small>Ajouter une recette au carnet</small></button>}</div>
    </section><aside className="closing-note"><ChefHat size={30} aria-hidden="true" /><p>Les meilleures recettes sont celles <em>que l’on partage.</em></p><span>Faites avec envie. Gardées avec soin.</span></aside></main><footer><a className="footer-brand" href="#top">Les recettes de Nico.</a><p>Cuisiner, goûter, recommencer.</p><a href="#top">Retour en haut ↑</a></footer>
  </>;
}
