import { revalidateTag, unstable_cache } from "next/cache";
import { getFirebaseAdmin } from "@/lib/firebase-token";
import { createFirestoreRecipe, FirestoreError, listFirestoreRecipes, updateFirestoreRecipe } from "@/lib/firestore-recipes";

const readRecipes = unstable_cache(listFirestoreRecipes, ["firestore-recipes-v1"], { revalidate: 60, tags: ["recipes"] });
const maxBodyBytes = 64 * 1024;

function safeText(value: unknown, fallback = "", maxLength = 4000) { return typeof value === "string" ? value.trim().slice(0, maxLength) || fallback : fallback; }
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


function errorResponse(error: unknown) {
  if (error instanceof FirestoreError && error.status === 404) return Response.json({ error: "Recette introuvable." }, { status: 404 });
  if (error instanceof FirestoreError && [401, 403].includes(error.status)) return Response.json({ error: "Accès Firestore refusé. Vérifiez votre connexion administrateur." }, { status: 403 });
  return Response.json({ error: "Le carnet est momentanément indisponible. Réessayez dans un instant." }, { status: 503 });
}
export async function GET() {
  try { return Response.json({ recipes: await readRecipes() }); }
  catch (error) { return errorResponse(error); }
}
export async function POST(request: Request) {
  if (!await getFirebaseAdmin(request)) return Response.json({ error: "Accès administrateur requis." }, { status: 401 });
  try {
    const body = await readBody(request);
    if (body instanceof Response) return body;
    const values = valuesFrom(body);
    if (!values.title) return Response.json({ error: "Le nom de la recette est requis." }, { status: 400 });
    const recipe = await createFirestoreRecipe(values, request.headers.get("authorization")!);
    revalidateTag("recipes", { expire: 0 });
    return Response.json({ recipe }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
export async function PATCH(request: Request) {
  if (!await getFirebaseAdmin(request)) return Response.json({ error: "Accès administrateur requis." }, { status: 401 });
  try {
    const body = await readBody(request);
    if (body instanceof Response) return body;
    const values = valuesFrom(body);
    if (!values.title) return Response.json({ error: "Le nom de la recette est requis." }, { status: 400 });
    const id = typeof body.id === "string" ? body.id : "";
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id)) return Response.json({ error: "Recette à modifier invalide." }, { status: 400 });
    const recipe = await updateFirestoreRecipe(id, values, request.headers.get("authorization")!);
    revalidateTag("recipes", { expire: 0 });
    return Response.json({ recipe });
  } catch (error) { return errorResponse(error); }
}
