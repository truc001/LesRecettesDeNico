import { getFirebaseAdmin, getFirebaseUser } from "@/lib/firebase-token";
import { createFirestoreSubmission, listFirestoreSubmissions } from "@/lib/firestore-submissions";
import { FirestoreError } from "@/lib/firestore-recipes";
import { assertAllowedKeys, parseRecipeInput, RecipeInputError } from "@/lib/recipe-input";

const maxBodyBytes = 20 * 1024;

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return false;
  try { return new URL(origin).host === host; } catch { return false; }
}

async function readBody(request: Request): Promise<Record<string, unknown> | Response> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return Response.json({ error: "Format de requête invalide." }, { status: 415 });
  const raw = await request.text().catch(() => "");
  if (new TextEncoder().encode(raw).byteLength > maxBodyBytes) return Response.json({ error: "Proposition trop volumineuse." }, { status: 413 });
  try {
    const body: unknown = JSON.parse(raw);
    if (body && typeof body === "object" && !Array.isArray(body)) return body as Record<string, unknown>;
  } catch {}
  return Response.json({ error: "Données de recette invalides." }, { status: 400 });
}

function errorResponse(error: unknown) {
  if (error instanceof RecipeInputError) return Response.json({ error: error.message }, { status: 400 });
  if (error instanceof FirestoreError && [401, 403].includes(error.status)) return Response.json({ error: "Votre compte Google n’est pas autorisé à effectuer cette action." }, { status: 403 });
  return Response.json({ error: "Impossible d’enregistrer la proposition pour le moment." }, { status: 503 });
}

export async function GET(request: Request) {
  if (!await getFirebaseAdmin(request)) return Response.json({ error: "Accès administrateur requis." }, { status: 401 });
  try { return Response.json({ submissions: await listFirestoreSubmissions(request.headers.get("authorization")!) }); }
  catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Origine de la requête refusée." }, { status: 403 });
  const user = await getFirebaseUser(request);
  if (!user) return Response.json({ error: "Connectez-vous avec un compte Google vérifié pour proposer une recette." }, { status: 401 });
  try {
    const body = await readBody(request);
    if (body instanceof Response) return body;
    assertAllowedKeys(body, ["title", "category", "description", "duration", "servings", "ingredients", "steps", "contributor", "website"]);
    if (typeof body.website === "string" && body.website.trim()) return Response.json({ submitted: true }, { status: 201 });
    const values = parseRecipeInput({ ...body, emoji: "🍽️" }, true);
    const submission = await createFirestoreSubmission(values, user.uid, request.headers.get("authorization")!);
    return Response.json({ submitted: true, id: submission.id }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
