import { revalidateTag } from "next/cache";
import { readJsonBody, signInRequired } from "@/lib/api-request";
import { isAdmin } from "@/lib/admin";
import { StoreError } from "@/lib/db";
import { getFirebaseUser } from "@/lib/firebase-token";
import { assertAllowedKeys, parseRecipeInput, parseRecipeTag, RecipeInputError } from "@/lib/recipe-input";
import { createRecipe, deleteRecipe, updateRecipe } from "@/lib/recipes-store";
import { getRecipes, RECIPES_TAG } from "@/lib/recipes-cache";

const maxBodyBytes = 64 * 1024;
const recipeId = /^[a-zA-Z0-9_-]{1,128}$/;

function errorResponse(error: unknown) {
  if (error instanceof RecipeInputError) return Response.json({ error: error.message }, { status: 400 });
  if (error instanceof StoreError && error.status === 404) return Response.json({ error: "Recette introuvable." }, { status: 404 });
  if (error instanceof StoreError && error.status === 400) return Response.json({ error: "Données de recette invalides." }, { status: 400 });
  return Response.json({ error: "Le carnet est momentanément indisponible. Réessayez dans un instant." }, { status: 503 });
}
/** Null when the caller is the administrator, else the response refusing them. */
async function refuseUnlessAdmin(request: Request) {
  const user = await getFirebaseUser(request);
  if (!user) return signInRequired();
  return isAdmin(user) ? null : Response.json({ error: "Accès administrateur requis." }, { status: 403 });
}
export async function GET() {
  try { return Response.json({ recipes: await getRecipes() }); }
  catch (error) { return errorResponse(error); }
}
const editableKeys = ["title", "category", "description", "duration", "servings", "emoji", "ingredients", "steps", "contributor", "tag", "featured"];
function parseRecipe(body: Record<string, unknown>) {
  if ("featured" in body && typeof body.featured !== "boolean") throw new RecipeInputError("Le choix de Nico doit être coché ou décoché.");
  return { ...parseRecipeInput(body), ...("tag" in body ? { tag: parseRecipeTag(body.tag) } : {}), ...(typeof body.featured === "boolean" ? { featured: body.featured } : {}) };
}
export async function POST(request: Request) {
  const refused = await refuseUnlessAdmin(request);
  if (refused) return refused;
  try {
    const body = await readJsonBody(request, maxBodyBytes, "Recette trop volumineuse.");
    if (body instanceof Response) return body;
    assertAllowedKeys(body, editableKeys);
    const recipe = await createRecipe(parseRecipe(body));
    revalidateTag(RECIPES_TAG, { expire: 0 });
    return Response.json({ recipe }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
export async function PATCH(request: Request) {
  const refused = await refuseUnlessAdmin(request);
  if (refused) return refused;
  try {
    const body = await readJsonBody(request, maxBodyBytes, "Recette trop volumineuse.");
    if (body instanceof Response) return body;
    assertAllowedKeys(body, ["id", ...editableKeys]);
    const values = parseRecipe(body);
    const id = typeof body.id === "string" ? body.id : "";
    if (!recipeId.test(id)) return Response.json({ error: "Recette à modifier invalide." }, { status: 400 });
    const recipe = await updateRecipe(id, values);
    revalidateTag(RECIPES_TAG, { expire: 0 });
    return Response.json({ recipe });
  } catch (error) { return errorResponse(error); }
}
export async function DELETE(request: Request) {
  const refused = await refuseUnlessAdmin(request);
  if (refused) return refused;
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!recipeId.test(id)) return Response.json({ error: "Recette à supprimer invalide." }, { status: 400 });
  try {
    await deleteRecipe(id);
    revalidateTag(RECIPES_TAG, { expire: 0 });
    return Response.json({ deleted: true });
  } catch (error) { return errorResponse(error); }
}
