import type { Recipe } from "./notion-recipes";

type Value = { stringValue?: string; booleanValue?: boolean; timestampValue?: string };
type Document = { name: string; fields: Record<string, Value> };
export type RecipeValues = Pick<Recipe, "title" | "category" | "description" | "duration" | "servings" | "emoji" | "ingredients" | "steps">;

export class FirestoreError extends Error {
  constructor(public status: number) { super("Firestore request failed"); }
}
function collectionUrl() {
  const project = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!project) throw new Error("Firebase project is not configured");
  return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(project)}/databases/(default)/documents/recipes`;
}
function fromDocument(document: Document): Recipe & { createdAt?: string } {
  const f = document.fields;
  return {
    id: document.name.split("/").at(-1)!,
    title: f.title?.stringValue ?? "",
    category: f.category?.stringValue ?? "Mes recettes",
    description: f.description?.stringValue ?? "",
    duration: f.duration?.stringValue ?? "À préciser",
    servings: f.servings?.stringValue ?? "À préciser",
    emoji: f.emoji?.stringValue ?? "",
    ingredients: f.ingredients?.stringValue ?? "",
    steps: f.steps?.stringValue ?? "",
    featured: f.featured?.booleanValue ?? false,
    createdAt: f.createdAt?.timestampValue,
    ...(f.sourceId?.stringValue ? { sourceId: f.sourceId.stringValue } : {}),
  };
}
export async function listFirestoreRecipes(): Promise<Recipe[]> {
  const recipes: Array<Recipe & { createdAt?: string }> = [];
  let pageToken: string | undefined;
  do {
    const url = new URL(collectionUrl());
    url.searchParams.set("pageSize", "100");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new FirestoreError(response.status);
    const data = await response.json() as { documents?: Document[]; nextPageToken?: string };
    recipes.push(...(data.documents ?? []).map(fromDocument));
    pageToken = data.nextPageToken;
  } while (pageToken);
  return recipes.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? "") || String(a.id).localeCompare(String(b.id)));
}
function fieldsFrom(values: RecipeValues): Record<string, Value> {
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, { stringValue: value }]));
}
async function write(url: URL | string, method: string, fields: Record<string, Value>, authorization: string) {
  // Forward the user's Firebase ID token: Firestore Security Rules apply.
  // No service-account key or privileged server credential.
  const response = await fetch(url, {
    method, headers: { "Content-Type": "application/json", Authorization: authorization },
    body: JSON.stringify({ fields }), cache: "no-store", signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new FirestoreError(response.status);
  return fromDocument(await response.json() as Document);
}
export async function createFirestoreRecipe(values: RecipeValues, authorization: string) {
  return write(collectionUrl(), "POST", { ...fieldsFrom(values), featured: { booleanValue: false }, createdAt: { timestampValue: new Date().toISOString() } }, authorization);
}
export async function updateFirestoreRecipe(id: string, values: RecipeValues, authorization: string) {
  const url = new URL(`${collectionUrl()}/${encodeURIComponent(id)}`);
  Object.keys(values).forEach((field) => url.searchParams.append("updateMask.fieldPaths", field));
  url.searchParams.set("currentDocument.exists", "true");
  return write(url, "PATCH", fieldsFrom(values), authorization);
}
