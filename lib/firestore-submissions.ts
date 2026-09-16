import type { Recipe } from "@/lib/notion-recipes";
import type { RecipeInput } from "@/lib/recipe-input";
import { FirestoreError } from "@/lib/firestore-recipes";

type Value = { stringValue?: string; booleanValue?: boolean; timestampValue?: string };
type Document = { name: string; fields: Record<string, Value>; updateTime?: string };

export type RecipeSubmission = RecipeInput & {
  id: string;
  status: "pending" | "approved" | "rejected";
  submitterUid: string;
  createdAt: string;
  reviewedAt?: string;
  recipeId?: string;
};

function projectId() {
  const project = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!project) throw new Error("Firebase project is not configured");
  return project;
}

function collectionUrl() {
  return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId())}/databases/(default)/documents/recipeSubmissions`;
}

function fieldsFrom(values: Record<string, string>): Record<string, Value> {
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, { stringValue: value }]));
}

function fromDocument(document: Document): RecipeSubmission {
  const f = document.fields;
  return {
    id: document.name.split("/").at(-1)!,
    title: f.title?.stringValue ?? "",
    category: f.category?.stringValue ?? "Mes recettes",
    description: f.description?.stringValue ?? "",
    duration: f.duration?.stringValue ?? "À préciser",
    servings: f.servings?.stringValue ?? "À préciser",
    emoji: f.emoji?.stringValue ?? "🍽️",
    ingredients: f.ingredients?.stringValue ?? "",
    steps: f.steps?.stringValue ?? "",
    contributor: f.contributor?.stringValue ?? "",
    status: (f.status?.stringValue as RecipeSubmission["status"]) ?? "pending",
    submitterUid: f.submitterUid?.stringValue ?? "",
    createdAt: f.createdAt?.timestampValue ?? "",
    ...(f.reviewedAt?.timestampValue ? { reviewedAt: f.reviewedAt.timestampValue } : {}),
    ...(f.recipeId?.stringValue ? { recipeId: f.recipeId.stringValue } : {}),
  };
}

async function firestoreFetch(url: string, init: RequestInit, authorization: string) {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", Authorization: authorization, ...init.headers },
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new FirestoreError(response.status);
  return response;
}

export async function createFirestoreSubmission(values: RecipeInput, submitterUid: string, authorization: string) {
  const now = new Date().toISOString();
  const fields: Record<string, Value> = {
    ...fieldsFrom({ ...values, contributor: values.contributor, status: "pending", submitterUid }),
    createdAt: { timestampValue: now },
  };
  const response = await firestoreFetch(collectionUrl(), { method: "POST", body: JSON.stringify({ fields }) }, authorization);
  return fromDocument(await response.json() as Document);
}

export async function listFirestoreSubmissions(authorization: string) {
  const submissions: RecipeSubmission[] = [];
  let pageToken: string | undefined;
  do {
    const url = new URL(collectionUrl());
    url.searchParams.set("pageSize", "100");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const response = await firestoreFetch(url.toString(), { method: "GET" }, authorization);
    const data = await response.json() as { documents?: Document[]; nextPageToken?: string };
    submissions.push(...(data.documents ?? []).map(fromDocument));
    pageToken = data.nextPageToken;
  } while (pageToken);
  return submissions.filter((submission) => submission.status === "pending").sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function moderateFirestoreSubmission(id: string, action: "approve" | "reject", authorization: string): Promise<{ submission: RecipeSubmission; recipe?: Recipe }> {
  const submissionUrl = `${collectionUrl()}/${encodeURIComponent(id)}`;
  const currentResponse = await firestoreFetch(submissionUrl, { method: "GET" }, authorization);
  const current = await currentResponse.json() as Document;
  const submission = fromDocument(current);
  if (submission.status !== "pending" || !current.updateTime) throw new FirestoreError(409);

  const reviewedAt = new Date().toISOString();
  if (action === "reject") {
    const url = new URL(submissionUrl);
    ["status", "reviewedAt", "recipeId"].forEach((field) => url.searchParams.append("updateMask.fieldPaths", field));
    url.searchParams.set("currentDocument.updateTime", current.updateTime);
    const response = await firestoreFetch(url.toString(), { method: "PATCH", body: JSON.stringify({ fields: { status: { stringValue: "rejected" }, reviewedAt: { timestampValue: reviewedAt }, recipeId: { stringValue: "" } } }) }, authorization);
    return { submission: fromDocument(await response.json() as Document) };
  }

  const recipeId = `community-${id}`;
  const recipeName = `projects/${projectId()}/databases/(default)/documents/recipes/${recipeId}`;
  const recipeFields: Record<string, Value> = {
    ...fieldsFrom({ title: submission.title, category: submission.category, description: submission.description, duration: submission.duration, servings: submission.servings, emoji: submission.emoji, ingredients: submission.ingredients, steps: submission.steps, contributor: submission.contributor }),
    featured: { booleanValue: false },
    createdAt: { timestampValue: reviewedAt },
  };
  const updatedSubmissionFields = { ...current.fields, status: { stringValue: "approved" }, reviewedAt: { timestampValue: reviewedAt }, recipeId: { stringValue: recipeId } };
  const commitUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId())}/databases/(default)/documents:commit`;
  await firestoreFetch(commitUrl, { method: "POST", body: JSON.stringify({ writes: [
    { update: { name: recipeName, fields: recipeFields }, currentDocument: { exists: false } },
    { update: { name: current.name, fields: updatedSubmissionFields }, currentDocument: { updateTime: current.updateTime } },
  ] }) }, authorization);
  return {
    submission: { ...submission, status: "approved", reviewedAt, recipeId },
    recipe: { id: recipeId, title: submission.title, category: submission.category, description: submission.description, duration: submission.duration, servings: submission.servings, emoji: submission.emoji, ingredients: submission.ingredients, steps: submission.steps, contributor: submission.contributor || undefined, featured: false },
  };
}
