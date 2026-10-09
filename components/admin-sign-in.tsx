"use client";

import { useState } from "react";
import { signInWithPopup } from "firebase/auth";
import { LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { fetchIsAdmin } from "@/lib/admin-api";
import { createGoogleProvider, getFirebaseAuth } from "@/lib/firebase-client";

export function AdminSignIn({ onAdmin }: { onAdmin: () => void }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  async function logIn() {
    setLoggingIn(true); setError("");
    try {
      const auth = getFirebaseAuth();
      const user = auth.currentUser ?? (await signInWithPopup(auth, createGoogleProvider())).user;
      if (!await fetchIsAdmin(await user.getIdToken())) throw new Error("Ce compte Google peut proposer des recettes, mais n’est pas autorisé à administrer le carnet.");
      onAdmin(); setOpen(false);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Connexion Google impossible."); }
    finally { setLoggingIn(false); }
  }

  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><button className="privacy-link"><LockKeyhole size={13} aria-hidden="true" /> Administration</button></DialogTrigger>
    <DialogContent className="auth-dialog">
      <DialogHeader><DialogTitle>Administration</DialogTitle><DialogDescription>Connectez-vous avec le compte Google autorisé à gérer ce carnet.</DialogDescription></DialogHeader>
      {error && <p className="form-error" role="alert">{error}</p>}
      <DialogFooter><Button type="button" onClick={logIn} disabled={loggingIn}>{loggingIn ? "Connexion…" : "Continuer avec Google"}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
