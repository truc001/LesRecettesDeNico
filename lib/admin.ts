import type { FirebaseIdentity } from "@/lib/firebase-token";

/** The one administrator of the carnet: a verified Google account. */
export const ADMIN_EMAIL = "appcraft31@gmail.com";

export function isAdmin(user: FirebaseIdentity | null) {
  return user?.email === ADMIN_EMAIL;
}
