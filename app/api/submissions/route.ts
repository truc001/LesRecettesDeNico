import { readJsonBody, signInRequired } from "@/lib/api-request";
import { isAdmin } from "@/lib/admin";
import { StoreError } from "@/lib/db";
import { getFirebaseUser } from "@/lib/firebase-token";
import { createSubmission, listSubmissions } from "@/lib/submissions-store";
import { assertAllowedKeys, parseRecipeInput, RecipeInputError } from "@/lib/recipe-input";

const maxBodyBytes = 20 * 1024;

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return false;
  try { return new URL(origin).host === host; } catch { return false; }
}

function errorResponse(error: unknown) {
  if (error instanceof RecipeInputError) return Response.json({ error: error.message }, { status: 400 });
  if (error instanceof StoreError && error.status === 429) return Response.json({ error: "Vous avez déjà proposé 5 recettes aujourd’hui. Revenez demain pour en partager d’autres." }, { status: 429 });
  if (error instanceof StoreError && error.status === 400) return Response.json({ error: "Données de recette invalides." }, { status: 400 });
  return Response.json({ error: "Impossible d’enregistrer la proposition pour le moment." }, { status: 503 });
}

export async function GET(request: Request) {
  const user = await getFirebaseUser(request);
  if (!user) return signInRequired();
  if (!isAdmin(user)) return Response.json({ error: "Votre compte Google n’est pas autorisé à effectuer cette action." }, { status: 403 });
  try { return Response.json({ submissions: await listSubmissions() }); }
  catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Origine de la requête refusée." }, { status: 403 });
  const user = await getFirebaseUser(request);
  if (!user) return Response.json({ error: "Connectez-vous avec un compte Google vérifié pour proposer une recette." }, { status: 401 });
  try {
    const body = await readJsonBody(request, maxBodyBytes, "Proposition trop volumineuse.");
    if (body instanceof Response) return body;
    assertAllowedKeys(body, ["title", "category", "description", "duration", "servings", "ingredients", "steps", "contributor", "website"]);
    if (typeof body.website === "string" && body.website.trim()) return Response.json({ submitted: true }, { status: 201 });
    const values = parseRecipeInput({ ...body, emoji: "🍽️" }, true);
    const submission = await createSubmission(values, user.uid);
    return Response.json({ submitted: true, id: submission.id }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
