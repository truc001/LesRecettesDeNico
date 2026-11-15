import type { Recipe } from "@/lib/notion-recipes";
import { isoDate, query, StoreError } from "@/lib/db";

export type RecipeValues = Pick<Recipe, "title" | "category" | "description" | "duration" | "servings" | "emoji" | "ingredients" | "steps" | "contributor" | "tag">;
type EditableValues = Partial<RecipeValues> & { featured?: boolean };

// Recipe field → column. Only these can be written, so the column names below are never user input.
const columns: Record<keyof EditableValues, string> = {
  title: "title", category: "category", description: "description", duration: "duration", servings: "servings", emoji: "emoji",
  ingredients: "ingredients", steps: "steps", contributor: "contributor", tag: "tag", featured: "featured",
};

export function fromRow(row: Record<string, unknown>): Recipe {
  return {
    id: String(row.id),
    title: String(row.title ?? ""),
    category: String(row.category ?? "Mes recettes"),
    description: String(row.description ?? ""),
    duration: String(row.duration ?? "À préciser"),
    servings: String(row.servings ?? "À préciser"),
    emoji: String(row.emoji ?? ""),
    ingredients: String(row.ingredients ?? ""),
    steps: String(row.steps ?? ""),
    ...(row.contributor ? { contributor: String(row.contributor) } : {}),
    ...(row.tag ? { tag: String(row.tag) } : {}),
    featured: row.featured === true,
    createdAt: isoDate(row.created_at),
    ...(row.source_id ? { sourceId: String(row.source_id) } : {}),
  };
}

/** Empty optional labels are stored as NULL, as if they were never set. */
function columnValue(key: keyof EditableValues, value: unknown) {
  return (key === "contributor" || key === "tag") && value === "" ? null : value;
}

function entries(values: EditableValues) {
  return (Object.keys(columns) as Array<keyof EditableValues>).filter((key) => values[key] !== undefined).map((key) => [columns[key], columnValue(key, values[key])] as const);
}

export async function listRecipes(): Promise<Recipe[]> {
  const rows = await query("select * from recipes order by created_at desc, id");
  return rows.map(fromRow);
}

export async function createRecipe(values: RecipeValues & { featured?: boolean }) {
  const fields = entries(values);
  const names = ["id", ...fields.map(([name]) => name)];
  const params = [crypto.randomUUID(), ...fields.map(([, value]) => value)];
  const rows = await query(`insert into recipes (${names.join(", ")}) values (${params.map((_, i) => `$${i + 1}`).join(", ")}) returning *`, params);
  return fromRow(rows[0]);
}

export async function updateRecipe(id: string, values: EditableValues) {
  const fields = entries(values);
  if (!fields.length) throw new StoreError(400);
  const rows = await query(`update recipes set ${fields.map(([name], i) => `${name} = $${i + 2}`).join(", ")} where id = $1 returning *`, [id, ...fields.map(([, value]) => value)]);
  if (!rows.length) throw new StoreError(404);
  return fromRow(rows[0]);
}

export async function deleteRecipe(id: string) {
  const rows = await query("delete from recipes where id = $1 returning id", [id]);
  if (!rows.length) throw new StoreError(404);
}
