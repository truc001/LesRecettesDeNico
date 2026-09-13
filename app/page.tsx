"use client";

import Image from "next/image";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowUpRight, ChefHat, Clock3, Heart, Leaf, Plus, Search, Sparkles, UsersRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Recipe = { id: number | string; title: string; category: string; description: string; duration: string; servings: string; emoji: string; ingredients?: string; steps?: string; image?: string; featured?: boolean };
type ModelContext = { registerTool: (tool: { name: string; title: string; description: string; inputSchema: object; annotations: { readOnlyHint: boolean; untrustedContentHint: boolean }; execute: (input: unknown) => Promise<unknown> }, options: { signal: AbortSignal }) => void | Promise<void> };

const starterRecipes: Recipe[] = [
  { id: "tatin", title: "Tarte tatin aux pommes", category: "Desserts", description: "Pommes fondantes, caramel ambré et pâte croustillante.", duration: "1 h 10", servings: "6 pers.", emoji: "🍎", image: "/tarte-tatin.png", featured: true },
  { id: "pasta", title: "Pâtes crémeuses citron & basilic", category: "Pâtes", description: "Un dîner lumineux et prêt en moins de trente minutes.", duration: "25 min", servings: "2 pers.", emoji: "🍋" },
  { id: "curry", title: "Curry de légumes rôtis", category: "Végétarien", description: "Courge, pois chiches et lait de coco tout en douceur.", duration: "45 min", servings: "4 pers.", emoji: "🥕" },
  { id: "soup", title: "Velouté de potimarron", category: "Soupes", description: "Une soupe soyeuse à la châtaigne et au thym.", duration: "40 min", servings: "4 pers.", emoji: "🌰" },
];
const categories = ["Toutes", "Desserts", "Pâtes", "Végétarien", "Soupes"];

function RecipeCard({ recipe, compact = false }: { recipe: Recipe; compact?: boolean }) {
  const [liked, setLiked] = useState(false);
  return <article className={`recipe-card ${compact ? "recipe-card-compact" : ""}`}>
    {recipe.image ? <div className="recipe-image-wrap"><Image src={recipe.image} alt={recipe.title} fill sizes="(max-width: 760px) 100vw, 42vw" className="recipe-image" priority={recipe.featured} /><Badge className="recipe-badge">À cuisiner ce week-end</Badge></div> : <div className="recipe-symbol" aria-hidden="true">{recipe.emoji}</div>}
    <div className="recipe-content"><div className="recipe-topline"><span>{recipe.category}</span><button aria-label={liked ? "Retirer des favoris" : "Ajouter aux favoris"} className={`favorite ${liked ? "favorite-active" : ""}`} onClick={() => setLiked(!liked)}><Heart size={18} fill={liked ? "currentColor" : "none"} /></button></div><h3>{recipe.title}</h3><p>{recipe.description}</p><div className="recipe-meta"><span><Clock3 size={15} /> {recipe.duration}</span><span><UsersRound size={15} /> {recipe.servings}</span></div></div>
  </article>;
}

export default function Home() {
  const [activeCategory, setActiveCategory] = useState("Toutes");
  const [query, setQuery] = useState("");
  const [recipes, setRecipes] = useState<Recipe[]>(starterRecipes);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  useEffect(() => { fetch("/api/recipes").then((response) => response.ok ? response.json() : Promise.reject()).then((data: { recipes: Recipe[] }) => { if (data.recipes.length) setRecipes((current) => [...data.recipes, ...current]); }).catch(() => setNotice("Vos nouvelles recettes seront enregistrées dès que le carnet sera connecté.")); }, []);
  useEffect(() => {
    const context = (document as Document & { modelContext?: ModelContext }).modelContext;
    if (!context?.registerTool) return;
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
        const response = await fetch("/api/recipes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...recipeInput, emoji: "🍽️" }) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Impossible d’enregistrer la recette.");
        setRecipes((current) => [data.recipe, ...current]);
        setNotice("Recette enregistrée dans votre carnet.");
        return { id: data.recipe.id, title: data.recipe.title, status: "enregistrée" };
      },
    }, { signal: lifecycle.signal })).catch(() => undefined);
    return () => lifecycle.abort();
  }, []);
  const filteredRecipes = useMemo(() => recipes.filter((recipe) => { const inCategory = activeCategory === "Toutes" || recipe.category === activeCategory; return inCategory && `${recipe.title} ${recipe.description} ${recipe.category}`.toLowerCase().includes(query.trim().toLowerCase()); }), [activeCategory, query, recipes]);
  async function saveRecipe(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); const title = String(form.get("title") || "").trim(); if (!title) return;
    setSaving(true); setNotice(""); const payload = { title, category: String(form.get("category") || "Mes recettes"), description: String(form.get("description") || "Une recette à essayer."), duration: String(form.get("duration") || "À préciser"), servings: String(form.get("servings") || "À préciser"), ingredients: String(form.get("ingredients") || ""), steps: String(form.get("steps") || ""), emoji: "🍽️" };
    try { const response = await fetch("/api/recipes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }); const data = await response.json(); if (!response.ok) throw new Error(data.error); setRecipes((current) => [data.recipe, ...current]); setDialogOpen(false); setNotice("Recette enregistrée dans votre carnet."); } catch { setNotice("Impossible d’enregistrer cette recette pour le moment. Réessayez dans un instant."); } finally { setSaving(false); }
  }
  const featured = recipes.find((recipe) => recipe.featured) ?? recipes[0];
  const regularRecipes = filteredRecipes.filter((recipe) => recipe.id !== featured?.id);
  return <main>
    <header className="site-header"><a className="brand" href="#top" aria-label="Les recettes de Nico, accueil"><span className="brand-mark"><ChefHat size={22} /></span><span>Les recettes<br /><em>de Nico</em></span></a><nav className="main-nav" aria-label="Navigation principale"><a className="nav-active" href="#carnet">Mon carnet</a><a href="#inspirations">Inspirations</a></nav><Dialog open={dialogOpen} onOpenChange={setDialogOpen}><DialogTrigger asChild><Button className="add-button"><Plus size={18} /> Ajouter une recette</Button></DialogTrigger><DialogContent className="recipe-dialog"><DialogHeader><DialogTitle>Nouvelle recette</DialogTitle><DialogDescription>Gardez l’essentiel maintenant, vous pourrez compléter la recette plus tard.</DialogDescription></DialogHeader><form onSubmit={saveRecipe} className="recipe-form"><label>Nom de la recette<Input required name="title" placeholder="Ex. Gratin de courgettes" /></label><div className="form-grid"><label>Catégorie<Input name="category" placeholder="Ex. Plats" /></label><label>Temps total<Input name="duration" placeholder="Ex. 45 min" /></label></div><div className="form-grid"><label>Portions<Input name="servings" placeholder="Ex. 4 pers." /></label><label>Petit résumé<Input name="description" placeholder="Ce qui la rend spéciale" /></label></div><label>Ingrédients<Textarea name="ingredients" placeholder="Un ingrédient par ligne" /></label><label>Préparation<Textarea name="steps" placeholder="Les étapes, même en version brouillon" /></label><DialogFooter><Button type="submit" disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer la recette"}</Button></DialogFooter></form></DialogContent></Dialog></header>
    <section className="hero" id="top"><div><p className="eyebrow"><Sparkles size={15} /> Mon carnet gourmand</p><h1>Des recettes qui<br /><i>racontent</i> quelque chose.</h1><p className="hero-copy">Toutes vos idées, vos classiques et vos essais réussis, réunis dans un seul endroit.</p></div><aside className="season-card"><Leaf size={20} /><span>À la une</span><strong>Cuisine d’automne</strong><p>Des recettes simples pour les premiers soirs frais.</p><a href="#carnet">Voir la sélection <ArrowUpRight size={16} /></a></aside></section>
    <section className="cookbook" id="carnet"><div className="toolbar"><div><p className="section-kicker">Votre collection</p><h2>Mes recettes</h2></div><label className="search-box"><Search size={18} /><span className="sr-only">Rechercher une recette</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher" /></label></div><div className="filter-row" aria-label="Filtrer les recettes">{categories.map((category) => <button key={category} onClick={() => setActiveCategory(category)} className={activeCategory === category ? "filter-active" : ""}>{category}</button>)}</div>{notice && <p className="notice" role="status">{notice}</p>}
      {featured && (activeCategory === "Toutes" || activeCategory === featured.category) && !query && <section className="featured" aria-label="Recette mise en avant"><div className="featured-copy"><p className="section-kicker">La recette du moment</p><h2>Le goût des dimanches<br />qui prennent leur temps.</h2><p>La tarte tatin est celle que l’on pose au centre de la table : généreuse, caramélisée et toujours un peu spectaculaire.</p><button className="text-link">Voir la recette <ArrowUpRight size={17} /></button></div><RecipeCard recipe={featured} compact /></section>}
      <div className="recipes-grid" id="inspirations">{regularRecipes.map((recipe) => <RecipeCard key={recipe.id} recipe={recipe} />)}{!filteredRecipes.length && <p className="empty-state">Aucune recette ne correspond à votre recherche.</p>}<button className="add-card" onClick={() => setDialogOpen(true)}><span><Plus size={23} /></span><strong>Ajouter une recette</strong><small>Une idée à ne pas oublier ?</small></button></div>
    </section><footer>Les recettes de Nico <span>•</span> Cuisiner, goûter, recommencer.</footer>
  </main>;
}
