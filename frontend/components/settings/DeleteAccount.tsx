"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Download } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { deleteAccount } from "@/app/dashboard/actions";
import { submitting } from "@/lib/form";

/**
 * Delete account.
 *
 * The friction is the feature. This is the only action in the app that cannot be
 * undone by any amount of work afterwards, so it asks for the account's own
 * email and the password, and puts the export link in front of the user at the
 * moment they are most likely to want it.
 *
 * The submit button stays disabled until the typed email matches, so the last
 * thing standing between a user and permanent loss is not a button they can hit
 * by reflex.
 */
export function DeleteAccount({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const matches = typed.trim().toLowerCase() === email.toLowerCase();

  function submit(form: FormData) {
    startTransition(async () => {
      const result = await deleteAccount({}, form);
      if (result.ok) {
        // replace, not push: the dashboard behind us belongs to an account that
        // no longer exists, and the back button should not offer to go there.
        // refresh() then drops the cached RSC payloads for those routes.
        router.replace("/");
        router.refresh();
      } else {
        setError(result.error ?? "Could not delete the account.");
      }
    });
  }

  function close() {
    setError(undefined);
    setTyped("");
    setOpen(false);
  }

  return (
    <>
      <div className="mb-1 text-[13px] font-medium" style={{ color: "var(--color-loss)" }}>
        Delete account
      </div>
      <p className="mb-4 text-[12px] leading-relaxed" style={{ color: "var(--text-faint)" }}>
        Removes your profile, accounts, transactions, loans, goals, PSX trades,
        fund orders, other assets, committees, budgets and Zakat records.
        Permanently, with no way back. Export your data first if there is any
        chance you will want it.
      </p>
      {/* Outlined rather than filled: red text on a red plate measured 4.44:1
          at rest and 3.8:1 on hover, both short of AA. The border carries the
          same warning without lifting the ground the label sits on. */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2.5 rounded-[10px] border px-4 py-2.5 text-[12.5px] font-medium transition-colors duration-200 hover:bg-[rgba(226,87,76,0.08)]"
        style={{ borderColor: "rgba(226,87,76,0.4)", color: "var(--color-loss)" }}
      >
        <Trash2 size={14} strokeWidth={1.8} />
        Delete my account
      </button>

      <Modal open={open} onClose={close} title="Delete your account?">
        <p className="text-[13.5px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          This removes everything you have entered, permanently. It cannot be
          undone, and support cannot recover it for you.
        </p>

        <a
          href="/api/export?format=json"
          className="mt-4 flex items-center gap-3 rounded-[10px] border px-4 py-3 text-[13px] transition-colors duration-200 hover:bg-[var(--surface-2)]"
          style={{ borderColor: "var(--border-subtle)" }}
        >
          <Download size={15} strokeWidth={1.7} style={{ color: "var(--brass-text)" }} />
          Download a copy of everything first
        </a>

        <form method="post" onSubmit={submitting(submit)} className="mt-5 flex flex-col gap-4">
          <Field
            label={`Type ${email} to confirm`}
            name="confirm_email"
            type="email"
            autoComplete="off"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={email}
            required
          />
          <Field
            label="Your password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            required
          />

          {error && (
            <p className="text-[12.5px]" style={{ color: "var(--color-loss)" }} role="alert">
              {error}
            </p>
          )}

          <div className="mt-2 flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={close}>
              Keep my account
            </Button>
            <button
              type="submit"
              disabled={!matches || pending}
              className="inline-flex h-11 items-center gap-2 whitespace-nowrap rounded-full px-[22px] text-[14px] font-[550] leading-none transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50"
              style={{ backgroundColor: "var(--color-loss)", color: "#0A0B0D" }}
            >
              {pending ? "Deleting…" : "Delete permanently"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
