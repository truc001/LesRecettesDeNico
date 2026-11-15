import { neon } from "@neondatabase/serverless";

/** Runs one parameterized SQL statement and returns its rows. */
export type Query = (text: string, params?: unknown[]) => Promise<Record<string, unknown>[]>;

/** Failed store operation, carrying the HTTP status it maps to. */
export class StoreError extends Error {
  constructor(public status: number) { super("Database request failed"); }
}

let override: Query | null = null;
let client: Query | null = null;

/** Lets the tests run the store against an in-memory Postgres. */
export function setDatabaseForTests(query: Query | null) {
  override = query;
}

function database(): Query {
  if (override) return override;
  if (!client) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not configured");
    const sql = neon(url);
    client = (text, params) => sql.query(text, params ?? []) as Promise<Record<string, unknown>[]>;
  }
  return client;
}

// Postgres error codes the API reports as such rather than as an outage.
const statusByCode: Record<string, number> = { "23505": 409, "23514": 400, "23502": 400, "22001": 400 };

export async function query(text: string, params: unknown[] = []) {
  try {
    return await database()(text, params);
  } catch (error) {
    const code = (error as { code?: unknown })?.code;
    if (typeof code === "string" && code in statusByCode) throw new StoreError(statusByCode[code]);
    throw error;
  }
}

export function isoDate(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  return typeof value === "string" && value ? new Date(value).toISOString() : undefined;
}
