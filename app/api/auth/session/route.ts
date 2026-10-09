import { getFirebaseUser } from "@/lib/firebase-token";
import { isFirestoreAdmin } from "@/lib/firestore-submissions";

export async function GET(request: Request) {
  const user = await getFirebaseUser(request);
  if (!user) return Response.json({ isAdmin: false, email: null });
  try {
    // The administrator is defined once, in firestore.rules.
    const isAdmin = await isFirestoreAdmin(request.headers.get("authorization")!);
    return Response.json({ isAdmin, email: isAdmin ? user.email : null });
  } catch {
    return Response.json({ error: "Vérification du compte impossible pour le moment." }, { status: 503 });
  }
}
