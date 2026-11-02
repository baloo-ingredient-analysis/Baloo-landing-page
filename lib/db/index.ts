// Lazy Postgres client (Order G1) — same optional-infrastructure pattern as lib/cache.ts:
// when DATABASE_URL is absent, db() returns null and the app keeps running (dev without a
// database, or any environment where Phase 3 isn't configured yet). Server-only — never import
// from client components.

import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Db = PostgresJsDatabase<typeof schema>;

let instance: Db | null = null;

export function db(): Db | null {
  if (instance) return instance;
  // DATABASE_URL for manual setups; POSTGRES_URL / POSTGRES_PRISMA_URL are what the
  // Vercel↔Supabase integration injects (both pooled). Prefer POSTGRES_URL (no Prisma-specific
  // query params).
  const url =
    process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? process.env.POSTGRES_PRISMA_URL;
  if (!url) return null;
  // Supabase (direct host or pooler) requires SSL. Enforce it in code rather than relying on the URL
  // carrying ?sslmode=require: local .env files routinely lose that param on a password reset, and the
  // connection then fails with ESSLREQUIRED. postgres.js 'require' encrypts without CA verification,
  // exactly what the pooler expects. Non-Supabase (e.g. a plain local Postgres) keeps the default.
  let ssl: "require" | undefined;
  try {
    ssl = /supabase\.(co|com)$/i.test(new URL(url).hostname) ? "require" : undefined;
  } catch {
    ssl = undefined;
  }
  // prepare:false is required by Supabase's transaction pooler (PgBouncer transaction mode
  // doesn't support prepared statements).
  const client = postgres(url, { prepare: false, ...(ssl ? { ssl } : {}) });
  instance = drizzle(client, { schema });
  return instance;
}
