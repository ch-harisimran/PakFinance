/**
 * Prove the rate limiter actually limits.
 *
 *   npx tsx scripts/verify-rate-limit.ts
 *
 * Exercises the real table, not a mock, because the whole design rests on the
 * counter being atomic in Postgres — a mock would test the arithmetic and miss
 * the only part that can go wrong under load.
 *
 * Cleans up its own keys.
 */
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

let failures = 0;
function check(label: string, pass: boolean, detail = "") {
  if (!pass) failures++;
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}${detail ? `  — ${detail}` : ""}`);
}

async function main() {
  const { consume, RULES } = await import("../lib/rate-limit");
  const { db } = await import("../lib/db/client");
  const { sql: raw } = await import("drizzle-orm");

  const id = `probe-${Date.now()}@example.invalid`;

  try {
    /* ── 1. Sequential: allowed up to the limit, blocked after ─────────── */
    const rule = "otpVerify" as const;
    const { limit } = RULES[rule];
    const seqId = `${id}-seq`;

    const results = [];
    for (let i = 0; i < limit + 2; i++) results.push(await consume(rule, seqId));

    const allowed = results.filter((r) => r.allowed).length;
    check(
      `exactly ${limit} attempts allowed, then blocked`,
      allowed === limit,
      `${allowed} allowed of ${limit + 2}`,
    );
    check("blocked attempts report a wait", results[limit].retryAfter > 0,
      `${results[limit].retryAfter}s`);
    check("remaining counts down to zero", results[limit - 1].remaining === 0);

    /* ── 2. Concurrent: the race the single-statement design exists for ── */
    const raceId = `${id}-race`;
    const parallel = await Promise.all(
      Array.from({ length: limit + 5 }, () => consume(rule, raceId)),
    );
    const allowedParallel = parallel.filter((r) => r.allowed).length;

    // Read-then-write would let several requests read the same count and all
    // believe they were under the limit. This is the failure an attacker
    // produces for free by firing requests in parallel.
    check(
      `concurrent burst still allows at most ${limit}`,
      allowedParallel <= limit,
      `${allowedParallel} of ${limit + 5} got through`,
    );

    /* ── 3. Keys are independent ────────────────────────────────────────── */
    const otherId = `${id}-other`;
    const fresh = await consume(rule, otherId);
    check("a different identifier is unaffected", fresh.allowed);

    /* ── 4. A different action has its own budget ───────────────────────── */
    const signInSame = await consume("signIn", seqId);
    check("a different action is a separate bucket", signInSame.allowed);

    /* ── 5. The window resets ───────────────────────────────────────────── */
    // Rewind this key's window past its length rather than waiting ten minutes.
    await db.execute(
      raw`update rate_limits
             set window_start = now() - interval '1 day', blocked_until = null
           where key = ${`${rule}:${seqId}`}`,
    );
    const afterWindow = await consume(rule, seqId);
    check("an expired window resets the count", afterWindow.allowed && afterWindow.remaining === limit - 1);
  } finally {
    // Matched on the unique probe id rather than an array parameter: drizzle's
    // template binds a JS array as a tuple, not a text[], so `= any(...)` fails.
    const removed = (await db.execute(
      raw`delete from rate_limits where key like ${`%${id}%`} returning 1`,
    )) as unknown as unknown[];
    console.log(`\ncleaned up ${removed.length} probe key(s)`);
  }

  console.log(failures ? `\n${failures} FAILED` : "\nall checks passed");
  process.exit(failures ? 1 : 0);
}

main().catch((e: unknown) => {
  console.error("verification errored:", (e as Error).message);
  process.exit(1);
});
