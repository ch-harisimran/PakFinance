import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";

config({ path: ".env.local" });

/**
 * Migrations use the DIRECT connection, not the pooler.
 *
 * The transaction pooler runs in transaction mode, which has no support for
 * prepared statements or session-level state — both of which migrations use.
 * Pointed at port 6543 this fails with errors that don't name the real cause.
 *
 * This project uses the SESSION POOLER for migrations, not the direct host.
 * The direct host (db.*.supabase.co) publishes only an AAAA record and proved
 * unreliable over IPv6 from here — clean auth errors one minute, connect
 * timeouts the next. The session pooler is IPv4 and supports session mode:
 *
 *   DATABASE_URL       aws-0-<region>.pooler.supabase.com:5432  (migrations)
 *   DATABASE_POOL_URL  aws-0-<region>.pooler.supabase.com:6543  (runtime)
 *
 * Same host and user; only the port differs.
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/db/schema/*.ts",
  out: "./lib/db/migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  schemaFilter: ["market", "public"],
  verbose: true,
  strict: true,
});
