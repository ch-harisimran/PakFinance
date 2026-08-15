import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as market from "@/lib/db/schema/market";

/**
 * The database client itself, without the `server-only` guard.
 *
 * Application code should import from `@/lib/db`, which re-exports this behind
 * that guard. This unguarded entry point exists for standalone scripts and the
 * scheduled sync job, which run under plain Node where `server-only` throws
 * because Next's module conditions are absent.
 *
 * Runtime queries use the POOLED connection: every serverless invocation opens
 * its own connection and Postgres caps concurrent connections around 60 on the
 * free tier.
 */
const connectionString = process.env.DATABASE_POOL_URL ?? process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_POOL_URL (or DATABASE_URL) is not set. Copy frontend/.env.example to .env.local.",
  );
}

const client = postgres(connectionString, {
  // The transaction pooler does not support prepared statements.
  prepare: false,
  max: 5,
  idle_timeout: 20,
});

export const db = drizzle(client, { schema: { ...market } });

export { market };
