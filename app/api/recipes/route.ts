import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { recipes } from "@/db/schema";
import { getFirebaseAdmin } from "@/lib/firebase-admin";
import { notionRecipes } from "@/lib/notion-recipes";

function safeText(value: unknown, fallback = "") { return typeof value === "string" ? value.trim().slice(0, 4000) || fallback : fallback; }
function messageFor(error: unknown) { const message = error instanceof Error ? error.message : "Erreur inattendue"; return message.includes("no such table") ? "Le carnet est en cours de préparation. Réessayez dans un instant." : "Le carnet est momentanément indisponible. Réessayez dans un instant."; }
function valuesFrom(body: Record<string, unknown>) { return { title: safeText(body.title), category: safeText(body.category, "Mes recettes"), description: safeText(body.description, "Une recette à essayer."), duration: safeText(body.duration, "À préciser"), servings: safeText(body.servings, "À préciser"), emoji: safeText(body.emoji, "🍽️"), ingredients: safeText(body.ingredients), steps: safeText(body.steps) }; }

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
    const values = valuesFrom(await request.json() as Record<string, unknown>);
    if (!values.title) return Response.json({ error: "Le nom de la recette est requis." }, { status: 400 });
    const [recipe] = await getDb().insert(recipes).values(values).returning();
    return Response.json({ recipe }, { status: 201 });
  } catch (error) { return Response.json({ error: messageFor(error) }, { status: 500 }); }
}

export async function PATCH(request: Request) {
  if (!await getFirebaseAdmin(request)) return Response.json({ error: "Accès administrateur requis." }, { status: 401 });
  try {
    const body = await request.json() as Record<string, unknown>;
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
