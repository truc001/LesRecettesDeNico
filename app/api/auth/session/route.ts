import { isAdmin } from "@/lib/admin";
import { getFirebaseUser } from "@/lib/firebase-token";

export async function GET(request: Request) {
  const user = await getFirebaseUser(request);
  // The administrator is defined once, in lib/admin.ts.
  const admin = isAdmin(user);
  return Response.json({ isAdmin: admin, email: admin ? user!.email : null });
}
