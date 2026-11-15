// Copies the carnet from Firestore to Neon. Re-runnable: it applies db/schema.sql,
// then inserts or refreshes every Firestore recipe, so a second run after the
// switch picks up any edit made in between. Nothing is ever deleted from Firestore.
//
//   DATABASE_URL=postgres://… GOOGLE_ACCESS_TOKEN=$(gcloud auth print-access-token) npm run db:migrate
//
// Recipes are public and need no token. Pending proposals and the proposal
// counters are private: without GOOGLE_ACCESS_TOKEN they are skipped, with a warning.
// --dry-run reads Firestore and reports what would be copied, without touching Neon.
import { readFile } from "node:fs/promises";

const FIRESTORE_PROJECT = "lesrecettesdenico-51466";
const recipeColumns = ["id", "title", "category", "description", "duration", "servings", "emoji", "ingredients", "steps", "contributor", "tag", "source_id", "featured", "created_at"];
const submissionColumns = ["id", "title", "category", "description", "duration", "servings", "emoji", "ingredients", "steps", "contributor", "submitter_uid", "created_at"];

export function schemaStatements(sql) {
  return sql.split(/;\s*$/m).map((statement) => statement.trim()).filter((statement) => statement.replace(/^--.*$/gm, "").trim());
}

async function listCollection(fetchImpl, project, collection, accessToken) {
  const documents = [];
  let pageToken;
  do {
    const url = new URL(`https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/${collection}`);
    url.searchParams.set("pageSize", "300");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const headers = accessToken ? { Authorization: `Bearer ${accessToken}`, "x-goog-user-project": project } : {};
    const response = await fetchImpl(url, { headers });
    if (!response.ok) throw new Error(`Lecture de ${collection} refusée par Firestore (${response.status}).`);
    const data = await response.json();
    documents.push(...(data.documents ?? []));
    pageToken = data.nextPageToken;
  } while (pageToken);
  return documents;
}

const text = (fields, key) => fields[key]?.stringValue;
const optional = (value) => (value ? value : null);

export function recipeRow(document) {
  const f = document.fields ?? {};
  return {
    id: document.name.split("/").at(-1),
    title: text(f, "title") ?? "", category: text(f, "category") ?? "Mes recettes", description: text(f, "description") ?? "",
    duration: text(f, "duration") ?? "À préciser", servings: text(f, "servings") ?? "À préciser", emoji: text(f, "emoji") ?? "🍽️",
    ingredients: text(f, "ingredients") ?? "", steps: text(f, "steps") ?? "",
    contributor: optional(text(f, "contributor")), tag: optional(text(f, "tag")), source_id: optional(text(f, "sourceId")),
    featured: f.featured?.booleanValue === true,
    created_at: f.createdAt?.timestampValue ?? document.createTime,
  };
}

export function submissionRow(document) {
  const f = document.fields ?? {};
  return { ...recipeRow(document), contributor: text(f, "contributor") ?? "", submitter_uid: text(f, "submitterUid"), status: text(f, "status") };
}

function upsert(table, columns, row) {
  const updates = columns.filter((column) => column !== "id").map((column) => `${column} = excluded.${column}`).join(", ");
  return [
    `insert into ${table} (${columns.join(", ")}) values (${columns.map((_, i) => `$${i + 1}`).join(", ")}) on conflict (id) do update set ${updates}`,
    columns.map((column) => row[column]),
  ];
}

export async function migrate({ query, fetch: fetchImpl = globalThis.fetch, project = FIRESTORE_PROJECT, accessToken, schema, dryRun = false, log = console.log }) {
  const recipes = (await listCollection(fetchImpl, project, "recipes")).map(recipeRow);
  let submissions = null;
  let limits = null;
  if (accessToken) {
    submissions = (await listCollection(fetchImpl, project, "recipeSubmissions", accessToken)).map(submissionRow).filter((row) => row.status === "pending");
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    limits = (await listCollection(fetchImpl, project, "submissionLimits", accessToken)).map((document) => ({
      submitter_uid: document.name.split("/").at(-1),
      window_start: document.fields?.windowStart?.timestampValue,
      count: Number(document.fields?.count?.integerValue ?? 0),
      last_at: document.fields?.lastAt?.timestampValue ?? document.fields?.windowStart?.timestampValue,
    })).filter((row) => row.window_start && Date.parse(row.window_start) > dayAgo && row.count >= 1 && row.count <= 5);
  } else {
    log("GOOGLE_ACCESS_TOKEN absent : les propositions en attente et leurs compteurs ne sont pas copiés.");
  }
  log(`Firestore : ${recipes.length} recettes${submissions ? `, ${submissions.length} propositions en attente, ${limits.length} compteurs actifs` : ""}.`);
  if (dryRun) return { recipes: recipes.length, submissions: submissions?.length ?? null, limits: limits?.length ?? null };

  for (const statement of schemaStatements(schema)) await query(statement);
  for (const row of recipes) await query(...upsert("recipes", recipeColumns, row));
  for (const row of submissions ?? []) await query(...upsert("recipe_submissions", submissionColumns, row));
  for (const row of limits ?? []) {
    await query(`insert into submission_limits (submitter_uid, window_start, count, last_at) values ($1, $2, $3, $4)
      on conflict (submitter_uid) do update set window_start = excluded.window_start, count = excluded.count, last_at = excluded.last_at`,
    [row.submitter_uid, row.window_start, row.count, row.last_at]);
  }

  // Every Firestore recipe must now be in Neon, with the same text.
  const stored = new Map((await query("select id, title, ingredients, steps from recipes")).map((row) => [row.id, row]));
  const missing = recipes.filter((row) => { const copy = stored.get(row.id); return !copy || copy.title !== row.title || copy.ingredients !== row.ingredients || copy.steps !== row.steps; });
  if (missing.length) throw new Error(`Recettes absentes ou différentes dans Neon : ${missing.map((row) => row.id).join(", ")}`);
  const extra = [...stored.keys()].filter((id) => !recipes.some((row) => row.id === id));
  if (extra.length) log(`Recettes présentes dans Neon seulement (créées après la bascule ?) : ${extra.join(", ")}`);
  log(`Neon : ${stored.size} recettes, toutes celles de Firestore sont copiées à l’identique.`);
  return { recipes: recipes.length, submissions: submissions?.length ?? null, limits: limits?.length ?? null, extra };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dryRun = process.argv.includes("--dry-run");
  const url = process.env.DATABASE_URL;
  if (!url && !dryRun) { console.error("Définissez DATABASE_URL (chaîne de connexion Neon)."); process.exit(1); }
  const schema = await readFile(new URL("../db/schema.sql", import.meta.url), "utf8");
  let query = null;
  if (!dryRun) {
    const { neon } = await import("@neondatabase/serverless");
    const sql = neon(url);
    query = (statement, params = []) => sql.query(statement, params);
  }
  migrate({ query, accessToken: process.env.GOOGLE_ACCESS_TOKEN, schema, dryRun }).catch((error) => { console.error(error.message ?? error); process.exit(1); });
}
