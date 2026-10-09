/** Reads a bounded JSON object body, or returns the error response to send back. */
export async function readJsonBody(request: Request, maxBytes: number, tooLarge: string): Promise<Record<string, unknown> | Response> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return Response.json({ error: "Format de requête invalide." }, { status: 415 });
  const raw = await request.text().catch(() => "");
  if (new TextEncoder().encode(raw).byteLength > maxBytes) return Response.json({ error: tooLarge }, { status: 413 });
  try {
    const body: unknown = JSON.parse(raw);
    if (body && typeof body === "object" && !Array.isArray(body)) return body as Record<string, unknown>;
  } catch {}
  return Response.json({ error: "Données de recette invalides." }, { status: 400 });
}

export const signInRequired = () => Response.json({ error: "Connectez-vous avec un compte Google vérifié." }, { status: 401 });
