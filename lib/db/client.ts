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

/**
 * NEVER await more than `max` (5) Drizzle queries concurrently on this client.
 *
 * Drizzle's postgres-js driver does not resume queries it queues once the pool
 * has an open connection: fire eight at once through `Promise.all` and exactly
 * five resolve while the other three hang forever — no error, no timeout, and
 * nothing in `pg_stat_activity` to show for it, because the connections are
 * sitting idle server-side while the client waits on them. Raw postgres.js
 * queues twenty on a pool of five without complaint, so this is the ORM's bug,
 * not a pool limit, and widening `max` only moves the cliff.
 *
 * Current widest fan-outs, for whoever adds the next one:
 *   app/dashboard/page.tsx    5  (3 in getDashboard's second wave + net worth
 *                                 series + market state) — AT THE LIMIT
 *   app/dashboard/psx/page.tsx 4
 *
 * The dashboard has no headroom. Adding one more concurrent Drizzle read to it
 * will hang the page. Sequence them, or batch in groups of four.
 *
 * Note this counts Drizzle queries only — the user-facing reads in
 * lib/queries.ts go through Supabase over HTTP and are unaffected.
 */

export const db = drizzle(client, { schema: { ...market } });

export { market };
