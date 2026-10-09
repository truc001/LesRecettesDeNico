import { createRemoteJWKSet, jwtVerify } from "jose";

const firebaseKeys = createRemoteJWKSet(new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"), { cacheMaxAge: 60 * 60 * 1000, timeoutDuration: 5000 });

type FirebaseClaims = { email?: unknown; email_verified?: unknown; name?: unknown; sub?: unknown; auth_time?: unknown; iat?: unknown; firebase?: { sign_in_provider?: unknown } };

export type FirebaseIdentity = { email: string; uid: string; name: string; provider: "google.com" };

export async function getFirebaseUser(request: Request): Promise<FirebaseIdentity | null> {
  const token = request.headers.get("authorization")?.match(/^Bearer ([\w-]+\.[\w-]+\.[\w-]+)$/i)?.[1];
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!token || token.length > 4096 || !projectId) return null;
  try {
    const { payload } = await jwtVerify<FirebaseClaims>(token, firebaseKeys, { algorithms: ["RS256"], audience: projectId, issuer: `https://securetoken.google.com/${projectId}`, requiredClaims: ["exp", "iat", "sub", "auth_time"] });
    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.sub !== "string" || !payload.sub || typeof payload.iat !== "number" || payload.iat > now || typeof payload.auth_time !== "number" || payload.auth_time > now) return null;
    const email = typeof payload.email === "string" ? payload.email.toLowerCase() : "";
    const provider = payload.firebase?.sign_in_provider;
    if (payload.email_verified !== true || !email || provider !== "google.com") return null;
    return { email, uid: payload.sub, name: typeof payload.name === "string" ? payload.name.slice(0, 80) : "", provider };
  } catch { return null; }
}
