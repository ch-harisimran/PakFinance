"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { FormShell } from "@/components/forms/FormShell";
import { deleteRow, type FormState } from "@/app/dashboard/actions";

/**
 * Edit and delete for one record.
 *
 * Every record type gets the same affordance in the same place, because the
 * alternative — an edit pencil here, a delete link there — makes the user hunt
 * for a control they need precisely when they have made a mistake.
 *
 * Deletion is confirmed, and the confirmation names what is being destroyed and
 * anything that goes with it. `consequence` exists because two of these cascade:
 * removing a loan takes its payment history, and removing a goal takes its
 * contributions. A dialog that said only "Are you sure?" would be lying by
 * omission.
 */
export function RowActions({
  table,
  id,
  name,
  consequence,
  editTitle,
  editDescription,
  action,
  children,
  align = "right",
}: {
  /** Table for `deleteRow` — must be on its allowlist. */
  table: string;
  id: string;
  /** Shown in the delete confirmation so the user knows which row this is. */
  name: string;
  /** What else disappears. Omit when nothing else does. */
  consequence?: string;
  editTitle: string;
  editDescription?: string;
  action: (prev: FormState, form: FormData) => Promise<FormState>;
  /** The edit form's fields, pre-filled with this record's values. */
  children: ReactNode;
  align?: "left" | "right";
}) {
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const wrap = useRef<HTMLDivElement>(null);

  // Click-outside and Escape. Bound only while the menu is open — a listener per
  // row on every render would mean hundreds of them on a long ledger.
  useEffect(() => {
    if (!menu) return;

    const onDown = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setMenu(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu(false);
    };

    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  function confirmDelete() {
    startTransition(async () => {
      const result = await deleteRow(table, id);
      if (result?.ok) {
        setError(undefined);
        setConfirming(false);
      } else {
        setError(result?.error ?? "Could not delete that.");
      }
    });
  }

  return (
    <div ref={wrap} className="relative flex-none">
      <button
        type="button"
        onClick={() => setMenu((v) => !v)}
        aria-label={`Actions for ${name}`}
        aria-haspopup="menu"
        aria-expanded={menu}
        className="grid h-8 w-8 place-items-center rounded-[9px] transition-colors duration-200 hover:bg-[var(--surface-2)]"
        style={{ color: "var(--text-faint)" }}
      >
        <MoreHorizontal size={16} strokeWidth={1.8} />
      </button>

      {menu && (
        <div
          role="menu"
          className={`absolute top-9 z-20 w-[148px] overflow-hidden rounded-[10px] border py-1 ${
            align === "right" ? "right-0" : "left-0"
          }`}
          style={{
            backgroundColor: "#161920",
            borderColor: "var(--border-subtle)",
            boxShadow: "0 18px 40px -18px rgba(0,0,0,0.9)",
          }}
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenu(false);
              setEditing(true);
            }}
            className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[13px] transition-colors duration-150 hover:bg-[var(--surface-2)]"
          >
            <Pencil size={13.5} strokeWidth={1.8} style={{ color: "var(--text-muted)" }} />
            Edit
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenu(false);
              setConfirming(true);
            }}
            className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[13px] transition-colors duration-150 hover:bg-[var(--surface-2)]"
            style={{ color: "var(--color-loss)" }}
          >
            <Trash2 size={13.5} strokeWidth={1.8} />
            Delete
          </button>
        </div>
      )}

      <FormShell
        open={editing}
        onClose={() => setEditing(false)}
        title={editTitle}
        description={editDescription}
        action={action}
        submitLabel="Save changes"
      >
        <input type="hidden" name="id" value={id} />
        {children}
      </FormShell>

      <Modal
        open={confirming}
        onClose={() => {
          setError(undefined);
          setConfirming(false);
        }}
        title="Delete this record?"
      >
        <p className="text-[13.5px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          <b style={{ color: "var(--text-primary)" }}>{name}</b> will be removed permanently.
          {consequence ? ` ${consequence}` : ""} This cannot be undone.
        </p>

        {error && (
          <p className="mt-3 text-[12.5px]" style={{ color: "var(--color-loss)" }} role="alert">
            {error}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setError(undefined);
              setConfirming(false);
            }}
          >
            Keep it
          </Button>
          <button
            type="button"
            onClick={confirmDelete}
            disabled={pending}
            className="inline-flex h-11 items-center gap-2 whitespace-nowrap rounded-full px-[22px] text-[14px] font-[550] leading-none transition-colors duration-200 disabled:opacity-60"
            style={{ backgroundColor: "var(--color-loss)", color: "#0A0B0D" }}
          >
            {pending ? "Deleting…" : "Delete"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
