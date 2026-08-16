import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * Unit tests only.
 *
 * `lib/**` holds the arithmetic that decides every number the product shows —
 * cost basis, NAV valuation, money formatting, market hours, alert timing. All
 * of it is pure, so none of these tests need a database, a network or a browser,
 * and the whole suite runs in well under a second.
 *
 * Anything that DOES need the database lives in scripts/ and is run deliberately
 * (see `npm run test:rls`), because it writes to a real Supabase project and has
 * no business running on every save.
 */
export default defineConfig({
  test: {
    include: ["lib/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
});
