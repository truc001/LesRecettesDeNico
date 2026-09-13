import { getFirebaseAdmin } from "@/lib/firebase-token";

export async function GET(request: Request) {
  const admin = await getFirebaseAdmin(request);
  return Response.json({ isAdmin: Boolean(admin), email: admin?.email ?? null });
}
