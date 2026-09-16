"use client";

import { FormEvent, useState } from "react";
import type { User } from "firebase/auth";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getFirebaseAuth } from "@/lib/firebase-client";

export function ShareRecipeDialog({ user, categories, onSignIn }: { user: User | null; categories: string[]; onSignIn: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  async function signIn() {
    setSigningIn(true); setError("");
    try { await onSignIn(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Connexion Google impossible."); }
    finally { setSigningIn(false); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setError("");
    try {
      const token = await getFirebaseAuth().currentUser?.getIdToken();
      if (!token) throw new Error("Votre session Google a expiré. Reconnectez-vous.");
      const form = new FormData(event.currentTarget);
      const payload = Object.fromEntries(["title", "category", "description", "duration", "servings", "ingredients", "steps", "contributor", "website"].map((field) => [field, String(form.get(field) ?? "")]));
      const response = await fetch("/api/submissions", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Impossible d’envoyer cette recette.");
      setSubmitted(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Impossible d’envoyer cette recette."); }
    finally { setSaving(false); }
  }

  return <Dialog open={open} onOpenChange={(nextOpen) => { setOpen(nextOpen); if (!nextOpen) { setSubmitted(false); setError(""); } }}>
    <DialogTrigger asChild><Button variant="outline" className="share-button"><Plus size={17} /> Proposer une recette</Button></DialogTrigger>
    <DialogContent className="community-dialog">
      <DialogHeader>
        <p className="form-kicker">Recette de la communauté</p>
        <DialogTitle>Partagez votre recette</DialogTitle>
        <DialogDescription>Elle restera privée jusqu’à sa validation par l’administrateur.</DialogDescription>
      </DialogHeader>
      {submitted ? <div className="submission-success" role="status"><strong>Merci pour votre recette.</strong><p>Elle a bien été transmise et apparaîtra dans le carnet uniquement après validation.</p><DialogClose asChild><Button>Fermer</Button></DialogClose></div> : !user ? <div className="submission-signin"><p>Une connexion Google vérifiée est nécessaire pour limiter les envois frauduleux. Votre adresse ne sera ni publiée ni enregistrée avec la recette.</p>{error && <p className="form-error" role="alert">{error}</p>}<Button type="button" onClick={signIn} disabled={signingIn}>{signingIn ? "Connexion…" : "Continuer avec Google"}</Button></div> : <form onSubmit={submit} className="recipe-form community-form">
        <label className="recipe-title-field"><span>Nom de la recette <strong aria-hidden="true">*</strong></span><Input autoFocus required name="title" minLength={3} maxLength={200} placeholder="Ex. Tarte aux pommes de Mamie" autoComplete="off" /></label>
        <div className="form-grid"><label>Catégorie<Input required name="category" maxLength={80} placeholder="Ex. Dessert" list="community-categories" autoComplete="off" /><datalist id="community-categories">{categories.filter((category) => category !== "Toutes").map((category) => <option key={category} value={category} />)}</datalist></label><label>Signature <small>facultatif et public</small><Input name="contributor" maxLength={60} placeholder="Ex. Nicolas" autoComplete="off" /></label></div>
        <div className="recipe-main-fields"><label><span>Ingrédients <strong aria-hidden="true">*</strong></span><Textarea required name="ingredients" minLength={3} maxLength={4000} placeholder={"250 g de farine\n2 œufs\n100 g de sucre"} /><small>Un ingrédient par ligne</small></label><label><span>Préparation <strong aria-hidden="true">*</strong></span><Textarea required name="steps" minLength={3} maxLength={4000} placeholder={"Mélanger les ingrédients.\nVerser dans le moule.\nCuire 30 minutes."} /><small>Une étape par ligne</small></label></div>
        <details className="optional-details"><summary><span>Ajouter des détails</span><small>Temps, portions et résumé</small></summary><div className="optional-fields"><div className="form-grid"><label>Temps total<Input name="duration" maxLength={80} placeholder="Ex. 45 min" /></label><label>Portions<Input name="servings" maxLength={80} placeholder="Ex. 4 personnes" /></label></div><label>Petit résumé<Input name="description" maxLength={1000} placeholder="Ce qui rend cette recette spéciale" /></label></div></details>
        <label className="website-field" aria-hidden="true">Site internet<Input name="website" tabIndex={-1} autoComplete="off" /></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <p className="security-note">Les balises, scripts et caractères invisibles sont automatiquement refusés.</p>
        <DialogFooter className="recipe-actions"><DialogClose asChild><Button type="button" variant="outline" disabled={saving}>Annuler</Button></DialogClose><Button type="submit" disabled={saving}>{saving ? "Envoi…" : "Envoyer pour validation"}</Button></DialogFooter>
      </form>}
    </DialogContent>
  </Dialog>;
}
