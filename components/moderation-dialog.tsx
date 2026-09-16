"use client";

import { useCallback, useState } from "react";
import { Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { getFirebaseAuth } from "@/lib/firebase-client";
import type { Recipe } from "@/lib/notion-recipes";
import type { RecipeSubmission } from "@/lib/firestore-submissions";

export function ModerationDialog({ onPublished }: { onPublished: (recipe: Recipe) => void }) {
  const [submissions, setSubmissions] = useState<RecipeSubmission[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  const loadSubmissions = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const token = await getFirebaseAuth().currentUser?.getIdToken();
      if (!token) throw new Error("Session administrateur expirée.");
      const response = await fetch("/api/submissions", { headers: { Authorization: `Bearer ${token}` } });
      const data = await response.json() as { submissions?: RecipeSubmission[]; error?: string };
      if (!response.ok) throw new Error(data.error || "Impossible de charger les propositions.");
      setSubmissions(data.submissions ?? []);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Impossible de charger les propositions."); }
    finally { setLoading(false); }
  }, []);

  async function moderate(submission: RecipeSubmission, action: "approve" | "reject") {
    setBusyId(submission.id); setError("");
    try {
      const token = await getFirebaseAuth().currentUser?.getIdToken();
      if (!token) throw new Error("Session administrateur expirée.");
      const response = await fetch(`/api/submissions/${encodeURIComponent(submission.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ action }) });
      const data = await response.json() as { recipe?: Recipe; error?: string };
      if (!response.ok) throw new Error(data.error || "Impossible de traiter cette proposition.");
      setSubmissions((current) => current.filter((item) => item.id !== submission.id));
      if (data.recipe) onPublished(data.recipe);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Impossible de traiter cette proposition."); }
    finally { setBusyId(""); }
  }

  return <Dialog onOpenChange={(open) => { if (open) void loadSubmissions(); }}>
    <DialogTrigger asChild><Button variant="outline" className="moderation-button"><Inbox size={17} /> Propositions{submissions.length > 0 && <span>{submissions.length}</span>}</Button></DialogTrigger>
    <DialogContent className="moderation-dialog">
      <DialogHeader><p className="form-kicker">Administration</p><DialogTitle>Recettes à valider</DialogTitle><DialogDescription>Vérifiez chaque proposition avant de la rendre publique.</DialogDescription></DialogHeader>
      {error && <p className="form-error" role="alert">{error}</p>}
      {loading ? <p className="moderation-empty">Chargement des propositions…</p> : submissions.length === 0 ? <p className="moderation-empty">Aucune recette en attente.</p> : <div className="moderation-list">{submissions.map((submission) => <article key={submission.id} className="moderation-card">
        <header><div><span>{submission.category}</span><h3>{submission.title}</h3></div><small>{new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(submission.createdAt))}</small></header>
        {submission.contributor && <p className="moderation-contributor">Signature publique : {submission.contributor}</p>}
        <p>{submission.description}</p>
        <div className="moderation-content"><section><h4>Ingrédients</h4><p>{submission.ingredients}</p></section><section><h4>Préparation</h4><p>{submission.steps}</p></section></div>
        <div className="moderation-actions"><Button type="button" variant="outline" disabled={busyId === submission.id} onClick={() => moderate(submission, "reject")}>Refuser</Button><Button type="button" disabled={busyId === submission.id} onClick={() => moderate(submission, "approve")}>{busyId === submission.id ? "Traitement…" : "Publier"}</Button></div>
      </article>)}</div>}
    </DialogContent>
  </Dialog>;
}
