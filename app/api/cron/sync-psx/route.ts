import { timingSafeEqual } from "node:crypto";
import { runPsxSync } from "@/lib/market/sync";

/**
 * HTTP entry point for the PSX sync.
 *
 * The logic lives in lib/market/sync.ts so this route and the scheduled
 * GitHub Actions job execute exactly the same code path.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorised(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  // Length first: timingSafeEqual throws when the buffers differ in length.
  if (header.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(header), Buffer.from(expected));
}

async function handle(req: Request) {
  if (!authorised(req)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const force = new URL(req.url).searchParams.get("force") === "1";

  try {
    const result = await runPsxSync({ force });
    return Response.json({ ok: true, ...result });
  } catch (e) {
    return Response.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}

// GET as well as POST — most schedulers issue GET.
export const GET = handle;
export const POST = handle;
