import { timingSafeEqual } from "node:crypto";
import { runNavSync } from "@/lib/market/sync-nav";

/**
 * HTTP entry point for the MUFAP NAV sync.
 *
 * Logic lives in lib/market/sync-nav.ts so this route and the scheduled
 * GitHub Actions job run exactly the same code path.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorised(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  if (header.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(header), Buffer.from(expected));
}

async function handle(req: Request) {
  if (!authorised(req)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const force = new URL(req.url).searchParams.get("force") === "1";

  try {
    const result = await runNavSync({ force });
    return Response.json({ ok: true, ...result });
  } catch (e) {
    return Response.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
