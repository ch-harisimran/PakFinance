import "server-only";

/**
 * Guarded entry point for application code.
 *
 * The `server-only` import makes the build fail loudly if the database client
 * is ever pulled into a client component, rather than silently shipping a
 * connection string to the browser.
 *
 * Scripts and the scheduled sync import `@/lib/db/client` instead — they run
 * under plain Node, where this package throws for lack of Next's module
 * conditions.
 */
export { db, market } from "@/lib/db/client";
