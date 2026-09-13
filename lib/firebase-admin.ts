import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

function adminAuth() {
  const rawCredentials = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT;
  if (!rawCredentials) throw new Error("FIREBASE_ADMIN_SERVICE_ACCOUNT est absent.");
  const credentials = JSON.parse(rawCredentials) as { project_id?: string; client_email?: string; private_key?: string };
  const app = getApps().length ? getApps()[0] : initializeApp({ credential: cert({ ...credentials, privateKey: credentials.private_key?.replace(/\\n/g, "\n"), clientEmail: credentials.client_email, projectId: credentials.project_id }) });
  return getAuth(app);
}

export async function getFirebaseAdmin(request: Request) {
  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/i)?.[1];
  if (!token) return null;
  try {
    const user = await adminAuth().verifyIdToken(token);
    const allowedEmails = (process.env.ADMIN_EMAILS ?? "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean);
    const email = user.email?.toLowerCase();
    return user.email_verified && email && allowedEmails.includes(email) ? { email, uid: user.uid } : null;
  } catch { return null; }
}
