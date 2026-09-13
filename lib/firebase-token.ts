import { createRemoteJWKSet, jwtVerify } from "jose";

const firebaseKeys = createRemoteJWKSet(new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"), { cacheMaxAge: 60 * 60 * 1000, timeoutDuration: 5000 });

type FirebaseClaims = { email?: unknown; email_verified?: unknown; sub?: unknown; auth_time?: unknown; iat?: unknown };

export async function getFirebaseAdmin(request: Request) {
  const token = request.headers.get("authorization")?.match(/^Bearer ([\w-]+\.[\w-]+\.[\w-]+)$/i)?.[1];
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!token || token.length > 4096 || !projectId) return null;
  try {
    const { payload } = await jwtVerify<FirebaseClaims>(token, firebaseKeys, { algorithms: ["RS256"], audience: projectId, issuer: `https://securetoken.google.com/${projectId}`, requiredClaims: ["exp", "iat", "sub", "auth_time"] });
    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.sub !== "string" || !payload.sub || typeof payload.iat !== "number" || payload.iat > now || typeof payload.auth_time !== "number" || payload.auth_time > now) return null;
    const allowedEmails = (process.env.ADMIN_EMAILS ?? "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean);
    const email = typeof payload.email === "string" ? payload.email.toLowerCase() : "";
    return payload.email_verified === true && email && allowedEmails.includes(email) ? { email, uid: payload.sub } : null;
  } catch { return null; }
}
