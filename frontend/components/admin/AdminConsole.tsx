"use client";

import { useActionState, useRef, useState } from "react";
import { Upload, Lock, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { importNavAction, lockAction, type AdminActionState } from "@/app/admin/actions";

/**
 * The console itself.
 *
 * One job today: import the MUFAP NAV report. MUFAP's data routes all answer
 * `cf-mitigated: challenge`, so no server can fetch them, and the page offers no
 * download URL — only "save as". So a human saves it and uploads it here, and
 * the same parser the CLI uses writes the NAVs for every fund at once.
 */
export function AdminConsole({ email }: { email: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string>();
  const [state, importNav, importing] = useActionState<AdminActionState, FormData>(
    importNavAction,
    {},
  );

  return (
    <div className="flex flex-col gap-5">
      <div
        className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border px-5 py-4"
        style={{ borderColor: "var(--border-subtle)", backgroundColor: "var(--surface-1)" }}
      >
        <span className="text-[12.5px]" style={{ color: "var(--text-muted)" }}>
          Unlocked as <span style={{ color: "var(--text-primary)" }}>{email}</span>
        </span>
        <form action={lockAction}>
          <button
            type="submit"
            className="inline-flex min-h-[24px] items-center gap-2 text-[12.5px] underline-offset-4 hover:underline"
            style={{ color: "var(--text-faint)" }}
          >
            <Lock size={13} strokeWidth={1.8} />
            Lock console
          </button>
        </form>
      </div>

      <div
        className="rounded-[14px] border p-6"
        style={{ borderColor: "var(--border-subtle)", backgroundColor: "var(--surface-1)" }}
      >
        <div className="mb-1.5 text-[15px] font-medium">Mutual fund NAVs</div>
        <p className="mb-5 text-[12.5px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
          MUFAP serves the daily report as a page behind a bot check with no download
          link, so it cannot be fetched automatically. Open it, save the page, and
          upload the file here — every fund&rsquo;s NAV updates in one go.
        </p>

        <a
          href="https://www.mufap.com.pk/Industry/IndustryStatDaily?tab=1"
          target="_blank"
          rel="noopener noreferrer"
          className="mb-5 inline-flex min-h-[24px] items-center gap-2 text-[12.5px] underline-offset-4 hover:underline"
          style={{ color: "var(--brass-text)" }}
        >
          <ExternalLink size={13} strokeWidth={1.8} />
          Open the MUFAP report
        </a>

        <form action={importNav} className="flex flex-col gap-4">
          <input
            ref={input}
            type="file"
            name="report"
            accept=".html,.htm,text/html"
            aria-label="Choose the saved MUFAP report"
            className="hidden"
            onChange={(e) => setFileName(e.target.files?.[0]?.name)}
          />

          <button
            type="button"
            onClick={() => input.current?.click()}
            className="flex items-center gap-3 rounded-[10px] border px-4 py-3 text-left text-[13px] transition-colors duration-200 hover:bg-[var(--surface-2)]"
            style={{ borderColor: "var(--border-strong)" }}
          >
            <Upload size={15} strokeWidth={1.7} style={{ color: "var(--brass-text)" }} />
            <span className="min-w-0">
              <span className="block truncate">{fileName ?? "Choose the saved .html file"}</span>
              <span
                className="mt-0.5 block text-[11.5px]"
                style={{ color: "var(--text-faint)" }}
              >
                Whatever your browser saved the report as
              </span>
            </span>
          </button>

          {state.error && (
            <p className="text-[12.5px]" style={{ color: "var(--color-loss)" }} role="alert">
              {state.error}
            </p>
          )}
          {state.ok && !state.error && (
            <p className="text-[12.5px]" style={{ color: "var(--color-gain)" }} role="status">
              NAVs updated.
            </p>
          )}

          <div>
            <Button type="submit" variant="primary" disabled={importing || !fileName}>
              {importing ? "Reading the report…" : "Import NAVs"}
            </Button>
          </div>
        </form>

        <p className="mt-5 text-[11.5px] leading-relaxed" style={{ color: "var(--text-faint)" }}>
          PSX-listed ETFs need none of this — the price sync values them automatically.
        </p>
      </div>
    </div>
  );
}
