import type { Recipe } from "./notion-recipes";

/** How the carnet is browsed: by moment of the day first, the recipe's own category being finer. `chip` is the short name used in the filter bar. */
export const GROUPS = [
  { id: "petit-dejeuner", label: "Petit-déjeuner", chip: "Petit-déjeuner", categories: ["Petit-déjeuner"] },
  { id: "midi", label: "Repas du midi", chip: "Midi", categories: ["Repas du midi"] },
  { id: "soir", label: "Repas du soir", chip: "Soir", categories: ["Repas du soir"] },
  { id: "desserts", label: "Desserts et gâteaux", chip: "Desserts", categories: ["Dessert", "Pâtisserie"] },
  { id: "boissons", label: "Boissons", chip: "Boissons", categories: ["Boisson"] },
  // Categories created later from the editor land here until they get a group of their own.
  { id: "autres", label: "Bases et autres", chip: "Autres", categories: [] as string[] },
];
const OTHER = "autres";

export const TIME_FILTERS = [
  { id: "30", label: "30 min max", minutes: 30 },
  { id: "60", label: "1 h max", minutes: 60 },
];

export type BrowseFilters = { group: string; time: string; query: string; tag: string };

export const normalizeSearch = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export function groupOf(recipe: Pick<Recipe, "category">) {
  const category = normalizeSearch(recipe.category);
  return GROUPS.find((group) => group.categories.some((name) => normalizeSearch(name) === category))?.id ?? OTHER;
}

/** Minutes of "1 h 05 min" or "30 min (plus 1 h au frais)"; resting time in brackets is left out. Null when unknown. */
export function durationMinutes(duration: string) {
  const text = duration.split("(")[0];
  const hours = /(\d+)\s*h/.exec(text);
  const minutes = /(\d+)\s*min/.exec(text) ?? (hours ? /h\s*(\d+)/.exec(text) : null);
  if (!hours && !minutes) return null;
  return Number(hours?.[1] ?? 0) * 60 + Number(minutes?.[1] ?? 0);
}

export function matchesFilters(recipe: Recipe, filters: BrowseFilters) {
  if (filters.group && groupOf(recipe) !== filters.group) return false;
  if (filters.tag && recipe.tag !== filters.tag) return false;
  const limit = TIME_FILTERS.find((time) => time.id === filters.time)?.minutes;
  if (limit) {
    const minutes = durationMinutes(recipe.duration);
    if (minutes === null || minutes > limit) return false;
  }
  const search = normalizeSearch(filters.query.trim());
  return !search || normalizeSearch(`${recipe.title} ${recipe.description} ${recipe.category} ${recipe.ingredients} ${recipe.contributor ?? ""} ${recipe.tag ?? ""}`).includes(search);
}

/** "Le choix de Nico" first, the order received (newest first) otherwise. */
export function featuredFirst<T extends Pick<Recipe, "featured">>(recipes: T[]) {
  return [...recipes].sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)));
}
