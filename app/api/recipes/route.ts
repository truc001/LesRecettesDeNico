import { revalidateTag } from "next/cache";
import { readJsonBody, signInRequired } from "@/lib/api-request";
import { getFirebaseUser } from "@/lib/firebase-token";
import { createFirestoreRecipe, deleteFirestoreRecipe, FirestoreError, updateFirestoreRecipe } from "@/lib/firestore-recipes";
import { assertAllowedKeys, parseRecipeInput, RecipeInputError } from "@/lib/recipe-input";
import { getRecipes, RECIPES_TAG } from "@/lib/recipes-cache";

const maxBodyBytes = 64 * 1024;
const recipeId = /^[a-zA-Z0-9_-]{1,128}$/;

// Firestore Security Rules decide who the administrator is: the caller's
// own token is forwarded, so a refused write comes back as a 403 here.
function errorResponse(error: unknown) {
  if (error instanceof RecipeInputError) return Response.json({ error: error.message }, { status: 400 });
  if (error instanceof FirestoreError && error.status === 404) return Response.json({ error: "Recette introuvable." }, { status: 404 });
  if (error instanceof FirestoreError && [401, 403].includes(error.status)) return Response.json({ error: "Accès administrateur requis." }, { status: 403 });
  return Response.json({ error: "Le carnet est momentanément indisponible. Réessayez dans un instant." }, { status: 503 });
}
export async function GET() {
  try { return Response.json({ recipes: await getRecipes() }); }
  catch (error) { return errorResponse(error); }
}
const editableKeys = ["title", "category", "description", "duration", "servings", "emoji", "ingredients", "steps", "contributor", "featured"];
function parseRecipe(body: Record<string, unknown>) {
  if ("featured" in body && typeof body.featured !== "boolean") throw new RecipeInputError("Le choix de Nico doit être coché ou décoché.");
  return { ...parseRecipeInput(body), ...(typeof body.featured === "boolean" ? { featured: body.featured } : {}) };
}
export async function POST(request: Request) {
  if (!await getFirebaseUser(request)) return signInRequired();
  try {
    const body = await readJsonBody(request, maxBodyBytes, "Recette trop volumineuse.");
    if (body instanceof Response) return body;
    assertAllowedKeys(body, editableKeys);
    const recipe = await createFirestoreRecipe(parseRecipe(body), request.headers.get("authorization")!);
    revalidateTag(RECIPES_TAG, { expire: 0 });
    return Response.json({ recipe }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
export async function PATCH(request: Request) {
  if (!await getFirebaseUser(request)) return signInRequired();
  try {
    const body = await readJsonBody(request, maxBodyBytes, "Recette trop volumineuse.");
    if (body instanceof Response) return body;
    assertAllowedKeys(body, ["id", ...editableKeys]);
    const values = parseRecipe(body);
    const id = typeof body.id === "string" ? body.id : "";
    if (!recipeId.test(id)) return Response.json({ error: "Recette à modifier invalide." }, { status: 400 });
    const recipe = await updateFirestoreRecipe(id, values, request.headers.get("authorization")!);
    revalidateTag(RECIPES_TAG, { expire: 0 });
    return Response.json({ recipe });
  } catch (error) { return errorResponse(error); }
}
export async function DELETE(request: Request) {
  if (!await getFirebaseUser(request)) return signInRequired();
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!recipeId.test(id)) return Response.json({ error: "Recette à supprimer invalide." }, { status: 400 });
  try {
    await deleteFirestoreRecipe(id, request.headers.get("authorization")!);
    revalidateTag(RECIPES_TAG, { expire: 0 });
    return Response.json({ deleted: true });
  } catch (error) { return errorResponse(error); }
}
