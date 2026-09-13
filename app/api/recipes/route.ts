import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { recipes } from "@/db/schema";
import { getFirebaseAdmin } from "@/lib/firebase-token";
import { notionRecipes } from "@/lib/notion-recipes";

const maxBodyBytes = 64 * 1024;

function safeText(value: unknown, fallback = "", maxLength = 4000) { return typeof value === "string" ? value.trim().slice(0, maxLength) || fallback : fallback; }
function messageFor(error: unknown) { const message = error instanceof Error ? error.message : "Erreur inattendue"; return message.includes("no such table") ? "Le carnet est en cours de préparation. Réessayez dans un instant." : "Le carnet est momentanément indisponible. Réessayez dans un instant."; }
function valuesFrom(body: Record<string, unknown>) { return { title: safeText(body.title, "", 200), category: safeText(body.category, "Mes recettes", 80), description: safeText(body.description, "Une recette à essayer.", 1000), duration: safeText(body.duration, "À préciser", 80), servings: safeText(body.servings, "À préciser", 80), emoji: safeText(body.emoji, "🍽️", 16), ingredients: safeText(body.ingredients), steps: safeText(body.steps) }; }
async function readBody(request: Request): Promise<Record<string, unknown> | Response> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return Response.json({ error: "Format de requête invalide." }, { status: 415 });
  const raw = await request.text().catch(() => "");
  if (new TextEncoder().encode(raw).byteLength > maxBodyBytes) return Response.json({ error: "Recette trop volumineuse." }, { status: 413 });
  try {
    const body: unknown = JSON.parse(raw);
    if (body && typeof body === "object" && !Array.isArray(body)) return body as Record<string, unknown>;
  } catch {}
  return Response.json({ error: "Données de recette invalides." }, { status: 400 });
}

export async function GET() {
  try {
    const data = await getDb().select().from(recipes).orderBy(desc(recipes.createdAt), desc(recipes.id)).limit(60);
    const overrides = new Map(data.filter((recipe) => recipe.sourceId).map((recipe) => [recipe.sourceId, recipe]));
    const imported = notionRecipes.map((recipe) => {
      const saved = overrides.get(String(recipe.id));
      return saved ? { ...recipe, ...saved } : recipe;
    });
    return Response.json({ recipes: [...data.filter((recipe) => !recipe.sourceId), ...imported] });
  } catch (error) { return Response.json({ error: messageFor(error) }, { status: 500 }); }
}

export async function POST(request: Request) {
  if (!await getFirebaseAdmin(request)) return Response.json({ error: "Accès administrateur requis." }, { status: 401 });
  try {
    const body = await readBody(request);
    if (body instanceof Response) return body;
    const values = valuesFrom(body);
    if (!values.title) return Response.json({ error: "Le nom de la recette est requis." }, { status: 400 });
    const [recipe] = await getDb().insert(recipes).values(values).returning();
    return Response.json({ recipe }, { status: 201 });
  } catch (error) { return Response.json({ error: messageFor(error) }, { status: 500 }); }
}

export async function PATCH(request: Request) {
  if (!await getFirebaseAdmin(request)) return Response.json({ error: "Accès administrateur requis." }, { status: 401 });
  try {
    const body = await readBody(request);
    if (body instanceof Response) return body;
    const values = valuesFrom(body);
    if (!values.title) return Response.json({ error: "Le nom de la recette est requis." }, { status: 400 });
    const sourceId = safeText(body.sourceId);
    if (sourceId) {
      if (!notionRecipes.some((recipe) => recipe.id === sourceId)) return Response.json({ error: "Recette importée inconnue." }, { status: 400 });
      const existing = await getDb().select({ id: recipes.id }).from(recipes).where(eq(recipes.sourceId, sourceId)).limit(1);
      const [recipe] = existing.length
        ? await getDb().update(recipes).set(values).where(eq(recipes.id, existing[0].id)).returning()
        : await getDb().insert(recipes).values({ ...values, sourceId }).returning();
      return Response.json({ recipe });
    }
    const id = typeof body.id === "number" ? body.id : Number(body.id);
    if (!Number.isInteger(id) || id < 1) return Response.json({ error: "Recette à modifier invalide." }, { status: 400 });
    const [recipe] = await getDb().update(recipes).set(values).where(eq(recipes.id, id)).returning();
    if (!recipe) return Response.json({ error: "Recette introuvable." }, { status: 404 });
    return Response.json({ recipe });
  } catch (error) { return Response.json({ error: messageFor(error) }, { status: 500 }); }
}
