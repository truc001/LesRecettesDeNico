import type { Recipe } from "@/lib/notion-recipes";
import type { RecipeInput } from "@/lib/recipe-input";
import { documentsUrl, FirestoreError } from "@/lib/firestore-recipes";

type Value = { stringValue?: string; booleanValue?: boolean; timestampValue?: string; integerValue?: string };
type Document = { name: string; fields: Record<string, Value>; updateTime?: string };

export type RecipeSubmission = RecipeInput & {
  id: string;
  submitterUid: string;
  createdAt: string;
};

// Mirrored by the submissionLimits rules in firestore.rules.
const MAX_SUBMISSIONS_PER_WINDOW = 5;
const SUBMISSION_WINDOW_MS = 24 * 60 * 60 * 1000;

function projectId() {
  const project = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!project) throw new Error("Firebase project is not configured");
  return project;
}

function documentsPath() {
  return `projects/${projectId()}/databases/(default)/documents`;
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
    submitterUid: f.submitterUid?.stringValue ?? "",
    createdAt: f.createdAt?.timestampValue ?? "",
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

function commit(writes: unknown[], authorization: string) {
  return firestoreFetch(`${documentsUrl()}:commit`, { method: "POST", body: JSON.stringify({ writes }) }, authorization);
}

/** True when the Firestore rules treat this token as the administrator's. */
export async function isFirestoreAdmin(authorization: string) {
  try {
    await firestoreFetch(`${documentsUrl()}/recipeSubmissions?pageSize=1&mask.fieldPaths=status`, { method: "GET" }, authorization);
    return true;
  } catch (error) {
    if (error instanceof FirestoreError && [401, 403].includes(error.status)) return false;
    throw error;
  }
}

export async function createFirestoreSubmission(values: RecipeInput, submitterUid: string, authorization: string) {
  // The submission and the submitter's counter are written together: the
  // rules refuse one without the other, also for direct Firestore writes.
  const limitName = `${documentsPath()}/submissionLimits/${submitterUid}`;
  const limitUrl = `${documentsUrl()}/submissionLimits/${encodeURIComponent(submitterUid)}`;
  const current = await firestoreFetch(limitUrl, { method: "GET" }, authorization)
    .then((response) => response.json() as Promise<Document>)
    .catch((error) => { if (error instanceof FirestoreError && error.status === 404) return null; throw error; });
  const windowStart = current?.fields.windowStart?.timestampValue;
  const sameWindow = Boolean(windowStart && Date.parse(windowStart) > Date.now() - SUBMISSION_WINDOW_MS);
  const count = sameWindow ? Number(current?.fields.count?.integerValue ?? 0) + 1 : 1;
  if (count > MAX_SUBMISSIONS_PER_WINDOW) throw new FirestoreError(429);

  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  await commit([
    {
      update: { name: `${documentsPath()}/recipeSubmissions/${id}`, fields: { ...fieldsFrom({ ...values, status: "pending", submitterUid }), createdAt: { timestampValue: createdAt } } },
      currentDocument: { exists: false },
    },
    {
      update: { name: limitName, fields: { count: { integerValue: String(count) }, lastSubmissionId: { stringValue: id }, ...(sameWindow ? { windowStart: { timestampValue: windowStart } } : {}) } },
      updateTransforms: [
        { fieldPath: "lastAt", setToServerValue: "REQUEST_TIME" },
        ...(sameWindow ? [] : [{ fieldPath: "windowStart", setToServerValue: "REQUEST_TIME" }]),
      ],
      currentDocument: current?.updateTime ? { updateTime: current.updateTime } : { exists: false },
    },
  ], authorization);
  return { id };
}

export async function listFirestoreSubmissions(authorization: string) {
  const response = await firestoreFetch(`${documentsUrl()}:runQuery`, { method: "POST", body: JSON.stringify({ structuredQuery: {
    from: [{ collectionId: "recipeSubmissions" }],
    where: { fieldFilter: { field: { fieldPath: "status" }, op: "EQUAL", value: { stringValue: "pending" } } },
    limit: 100,
  } }) }, authorization);
  const rows = await response.json() as Array<{ document?: Document }>;
  return rows.flatMap((row) => row.document ? [fromDocument(row.document)] : []).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Moderation removes the proposal: approved ones become recipes, rejected ones disappear. */
export async function moderateFirestoreSubmission(id: string, action: "approve" | "reject", authorization: string): Promise<{ recipe?: Recipe }> {
  const currentResponse = await firestoreFetch(`${documentsUrl()}/recipeSubmissions/${encodeURIComponent(id)}`, { method: "GET" }, authorization);
  const current = await currentResponse.json() as Document;
  if (current.fields.status?.stringValue !== "pending" || !current.updateTime) throw new FirestoreError(409);
  const removeSubmission = { delete: current.name, currentDocument: { updateTime: current.updateTime } };
  if (action === "reject") {
    await commit([removeSubmission], authorization);
    return {};
  }

  const submission = fromDocument(current);
  const recipeId = `community-${id}`;
  const content = { title: submission.title, category: submission.category, description: submission.description, duration: submission.duration, servings: submission.servings, emoji: submission.emoji, ingredients: submission.ingredients, steps: submission.steps, contributor: submission.contributor };
  await commit([
    { update: { name: `${documentsPath()}/recipes/${recipeId}`, fields: { ...fieldsFrom(content), featured: { booleanValue: false }, createdAt: { timestampValue: new Date().toISOString() } } }, currentDocument: { exists: false } },
    removeSubmission,
  ], authorization);
  return { recipe: { id: recipeId, ...content, contributor: submission.contributor || undefined, featured: false } };
}
