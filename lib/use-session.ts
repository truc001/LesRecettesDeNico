"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { fetchIsAdmin } from "@/lib/admin-api";
import { getFirebaseAuth } from "@/lib/firebase-client";

/** Signed-in Google user, and whether Firestore treats them as the administrator. */
export function useSession() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    try {
      return onAuthStateChanged(getFirebaseAuth(), async (user) => {
        setCurrentUser(user);
        try { setIsAdmin(user ? await fetchIsAdmin(await user.getIdToken()) : false); }
        catch { setIsAdmin(false); }
      });
    } catch { /* The sign-in action reports any configuration error in its dialog. */ }
  }, []);
  return { currentUser, isAdmin, setIsAdmin };
}
