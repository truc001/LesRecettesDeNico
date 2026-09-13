import { adminCookie, createAdminSession, passwordMatches } from "@/lib/admin-auth";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { password?: unknown };
  if (typeof body.password !== "string" || !passwordMatches(body.password)) return Response.json({ error: "Identifiants invalides." }, { status: 401 });
  const token = createAdminSession();
  if (!token) return Response.json({ error: "La sécurité admin n’est pas configurée." }, { status: 503 });
  (await cookies()).set(adminCookie.name, token, adminCookie.options);
  return Response.json({ isAdmin: true });
}

export async function DELETE() {
  (await cookies()).set(adminCookie.name, "", { ...adminCookie.options, maxAge: 0 });
  return Response.json({ isAdmin: false });
}
