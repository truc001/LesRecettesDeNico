"use client";

import { getFirebaseAuth } from "@/lib/firebase-client";

/** Authorization header carrying the signed-in user's Firebase ID token. */
export async function authHeaders() {
  const token = await getFirebaseAuth().currentUser?.getIdToken();
  if (!token) throw new Error("Votre session Google a expiré. Reconnectez-vous.");
  return { Authorization: `Bearer ${token}` };
}

export async function fetchIsAdmin(token: string) {
  const response = await fetch("/api/auth/session", { headers: { Authorization: `Bearer ${token}` } });
  const data = await response.json() as { isAdmin?: boolean };
  return Boolean(data.isAdmin);
}
