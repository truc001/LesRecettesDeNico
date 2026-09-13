import { desc } from "drizzle-orm";
import { getDb } from "@/db";
import { recipes } from "@/db/schema";

function safeText(value: unknown, fallback = "") { return typeof value === "string" ? value.trim().slice(0, 4000) || fallback : fallback; }
function messageFor(error: unknown) { const message = error instanceof Error ? error.message : "Erreur inattendue"; return message.includes("no such table") ? "Le carnet est en cours de préparation. Réessayez dans un instant." : "Le carnet est momentanément indisponible. Réessayez dans un instant."; }

export async function GET() {
  try { const data = await getDb().select().from(recipes).orderBy(desc(recipes.createdAt), desc(recipes.id)).limit(60); return Response.json({ recipes: data }); }
  catch (error) { return Response.json({ error: messageFor(error) }, { status: 500 }); }
}
export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>; const title = safeText(body.title);
    if (!title) return Response.json({ error: "Le nom de la recette est requis." }, { status: 400 });
    const [recipe] = await getDb().insert(recipes).values({ title, category: safeText(body.category, "Mes recettes"), description: safeText(body.description, "Une recette à essayer."), duration: safeText(body.duration, "À préciser"), servings: safeText(body.servings, "À préciser"), emoji: "🍽️", ingredients: safeText(body.ingredients), steps: safeText(body.steps) }).returning();
    return Response.json({ recipe }, { status: 201 });
  } catch (error) { return Response.json({ error: messageFor(error) }, { status: 500 }); }
}
