import { decodeProtectedHeader, importX509, jwtVerify } from "jose";

const publicCertificatesUrl = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";

type FirebaseClaims = { email?: unknown; email_verified?: unknown; sub?: unknown; auth_time?: unknown; iat?: unknown };

export async function getFirebaseAdmin(request: Request) {
  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/i)?.[1];
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!token || !projectId) return null;
  try {
    const header = decodeProtectedHeader(token);
    if (header.alg !== "RS256" || typeof header.kid !== "string") return null;
    const response = await fetch(publicCertificatesUrl, { next: { revalidate: 3600 } });
    const certificates = await response.json() as Record<string, string>;
    const certificate = certificates[header.kid];
    if (!certificate) return null;
    const key = await importX509(certificate, "RS256");
    const { payload } = await jwtVerify<FirebaseClaims>(token, key, { algorithms: ["RS256"], audience: projectId, issuer: `https://securetoken.google.com/${projectId}` });
    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.sub !== "string" || !payload.sub || typeof payload.iat !== "number" || payload.iat > now || typeof payload.auth_time !== "number" || payload.auth_time > now) return null;
    const allowedEmails = (process.env.ADMIN_EMAILS ?? "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean);
    const email = typeof payload.email === "string" ? payload.email.toLowerCase() : "";
    return payload.email_verified === true && email && allowedEmails.includes(email) ? { email, uid: payload.sub } : null;
  } catch { return null; }
}
