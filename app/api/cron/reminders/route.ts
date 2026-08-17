import { timingSafeEqual } from "node:crypto";
import { runLoanReminders } from "@/lib/notify/reminders";

/**
 * HTTP entry point for loan repayment reminders.
 *
 * Logic lives in lib/notify/reminders.ts so this route and the scheduled job run
 * the same code path.
 *
 * GET is a dry run and POST sends, deliberately: a GET should never have the
 * side effect of emailing people, and something will eventually prefetch this
 * URL.
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

async function handle(req: Request, dryRun: boolean) {
  if (!authorised(req)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await runLoanReminders({ dryRun });
    return Response.json({ ok: true, ...result });
  } catch (e) {
    return Response.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}

export const GET = (req: Request) => handle(req, true);
export const POST = (req: Request) => handle(req, false);
