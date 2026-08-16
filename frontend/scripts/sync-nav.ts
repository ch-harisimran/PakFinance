/**
 * MUFAP NAV sync.
 *
 *   npx tsx scripts/sync-nav.ts --file fixtures/mufap.html   ← the working path
 *   npx tsx scripts/sync-nav.ts --force                       ← network (blocked)
 *
 * MUFAP sits behind a Cloudflare JavaScript challenge, so a server-side fetch
 * receives an interstitial rather than the report — verified from both a
 * residential connection and a GitHub runner. The supported route is therefore
 * a file saved from your own browser:
 *
 *   1. open the report, Ctrl+S, "Webpage, HTML Only"
 *   2. save into frontend/fixtures/
 *   3. run with --file
 *
 * Everything downstream is identical: same parser, same upserts, same
 * idempotency. Only the transport differs, so if MUFAP ever provides a feed or
 * allowlists a client, dropping --file is the entire change.
 */
import fs from "node:fs";
import path from "node:path";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

function fileArg(): string | undefined {
  const i = process.argv.indexOf("--file");
  if (i === -1) return undefined;
  const given = process.argv[i + 1];
  // A following flag is not a path — `--file --force` means "newest fixture".
  if (!given || given.startsWith("--")) return undefined;
  return path.resolve(given);
}

/** Newest .html in fixtures/, so `--file` alone picks the latest save. */
function newestFixture(): string | undefined {
  const dir = path.resolve("fixtures");
  if (!fs.existsSync(dir)) return undefined;
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith(".html"))
    .map((f) => ({ f: path.join(dir, f), t: fs.statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t);
  return files[0]?.f;
}

async function main() {
  const { runNavSync } = await import("../lib/market/sync-nav");

  const useFile = process.argv.includes("--file");
  let html: string | undefined;

  if (useFile) {
    const target = fileArg() ?? newestFixture();
    if (!target || !fs.existsSync(target)) {
      throw new Error("no saved report found — put one in frontend/fixtures/");
    }
    html = fs.readFileSync(target, "utf8");
    console.log(`reading ${path.basename(target)} (${Math.round(html.length / 1024)} KB)`);
  }

  const result = await runNavSync({ force: process.argv.includes("--force"), html });
  console.log(JSON.stringify(result));
}

main()
  .then(() => process.exit(0))
  .catch((e: unknown) => {
    console.error("nav sync failed:", (e as Error).message);
    process.exit(1);
  });
