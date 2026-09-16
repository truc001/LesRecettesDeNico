import { revalidateTag } from "next/cache";
import { getFirebaseAdmin } from "@/lib/firebase-token";
import { moderateFirestoreSubmission } from "@/lib/firestore-submissions";
import { FirestoreError } from "@/lib/firestore-recipes";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await getFirebaseAdmin(request)) return Response.json({ error: "Accès administrateur requis." }, { status: 401 });
  const { id } = await params;
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id)) return Response.json({ error: "Proposition invalide." }, { status: 400 });
  try {
    if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return Response.json({ error: "Format de requête invalide." }, { status: 415 });
    const body: unknown = await request.json();
    const action = body && typeof body === "object" && !Array.isArray(body) ? (body as { action?: unknown }).action : null;
    if (action !== "approve" && action !== "reject") return Response.json({ error: "Décision invalide." }, { status: 400 });
    const result = await moderateFirestoreSubmission(id, action, request.headers.get("authorization")!);
    if (action === "approve") revalidateTag("recipes", { expire: 0 });
    return Response.json(result);
  } catch (error) {
    if (error instanceof FirestoreError && error.status === 404) return Response.json({ error: "Proposition introuvable." }, { status: 404 });
    if (error instanceof FirestoreError && error.status === 409) return Response.json({ error: "Cette proposition a déjà été traitée." }, { status: 409 });
    if (error instanceof FirestoreError && [401, 403].includes(error.status)) return Response.json({ error: "Action refusée par Firestore." }, { status: 403 });
    return Response.json({ error: "Impossible de traiter cette proposition." }, { status: 503 });
  }
}
