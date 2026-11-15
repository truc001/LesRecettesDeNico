import type { Recipe } from "@/lib/notion-recipes";
import type { RecipeInput } from "@/lib/recipe-input";
import { isoDate, query, StoreError } from "@/lib/db";
import { fromRow as recipeFromRow } from "@/lib/recipes-store";

export type RecipeSubmission = RecipeInput & {
  id: string;
  submitterUid: string;
  createdAt: string;
};

const MAX_SUBMISSIONS_PER_WINDOW = 5;

function fromRow(row: Record<string, unknown>): RecipeSubmission {
  return {
    id: String(row.id),
    title: String(row.title), category: String(row.category), description: String(row.description),
    duration: String(row.duration), servings: String(row.servings), emoji: String(row.emoji),
    ingredients: String(row.ingredients), steps: String(row.steps), contributor: String(row.contributor ?? ""),
    submitterUid: String(row.submitter_uid),
    createdAt: isoDate(row.created_at) ?? "",
  };
}

/**
 * Records a proposal and counts it against its author's 24-hour allowance in
 * one statement: the counter row is locked while it is read, so simultaneous
 * proposals cannot slip past the limit, and the proposal is not saved without it.
 */
export async function createSubmission(values: RecipeInput, submitterUid: string) {
  const rows = await query(`
    with allowance as (
      insert into submission_limits as l (submitter_uid, window_start, count, last_at) values ($1, now(), 1, now())
      on conflict (submitter_uid) do update set
        count = case when l.window_start > now() - interval '24 hours' then l.count + 1 else 1 end,
        window_start = case when l.window_start > now() - interval '24 hours' then l.window_start else now() end,
        last_at = now()
      where l.window_start <= now() - interval '24 hours' or l.count < $2
      returning submitter_uid
    )
    insert into recipe_submissions (id, title, category, description, duration, servings, emoji, ingredients, steps, contributor, submitter_uid)
    select $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, submitter_uid from allowance
    returning id`,
  [submitterUid, MAX_SUBMISSIONS_PER_WINDOW, crypto.randomUUID(), values.title, values.category, values.description, values.duration, values.servings, values.emoji, values.ingredients, values.steps, values.contributor]);
  if (!rows.length) throw new StoreError(429);
  return { id: String(rows[0].id) };
}

export async function listSubmissions() {
  const rows = await query("select * from recipe_submissions order by created_at desc limit 100");
  return rows.map(fromRow);
}

/** Moderation removes the proposal: approved ones become recipes, rejected ones disappear. */
export async function moderateSubmission(id: string, action: "approve" | "reject"): Promise<{ recipe?: Recipe }> {
  if (action === "reject") {
    const rows = await query("delete from recipe_submissions where id = $1 returning id", [id]);
    if (!rows.length) throw new StoreError(404);
    return {};
  }
  // Moving the proposal is one statement, so it is never both a recipe and still pending.
  const rows = await query(`
    with moved as (delete from recipe_submissions where id = $1 returning *)
    insert into recipes (id, title, category, description, duration, servings, emoji, ingredients, steps, contributor)
    select 'community-' || id, title, category, description, duration, servings, emoji, ingredients, steps, nullif(contributor, '') from moved
    returning *`, [id]);
  if (!rows.length) throw new StoreError(404);
  return { recipe: recipeFromRow(rows[0]) };
}
