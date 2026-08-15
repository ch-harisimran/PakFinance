"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

/**
 * Dialog built on the native <dialog> element, so focus trapping, Escape and
 * inertness of the page behind come from the platform instead of ~200 lines of
 * hand-rolled focus management that never quite handles screen readers.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  if (!open) return null;

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        // Clicking the backdrop closes; clicking the panel must not.
        if (e.target === ref.current) onClose();
      }}
      className="m-auto w-[min(520px,calc(100vw-32px))] rounded-[18px] border p-0 backdrop:bg-black/60 backdrop:backdrop-blur-sm"
      style={{
        backgroundColor: "#111318",
        borderColor: "var(--border-subtle)",
        color: "var(--text-primary)",
        boxShadow: "var(--highlight-top), 0 40px 90px -30px rgba(0,0,0,0.85)",
      }}
    >
      <div
        className="flex items-start justify-between gap-6 border-b px-6 py-5"
        style={{ borderColor: "var(--border-subtle)" }}
      >
        <div>
          <h2 className="text-[16px] font-semibold tracking-[-0.01em]">{title}</h2>
          {description && (
            <p className="mt-1 text-[12.5px]" style={{ color: "var(--text-faint)" }}>
              {description}
            </p>
          )}
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          className="grid h-8 w-8 flex-none place-items-center rounded-[9px] transition-colors duration-200 hover:bg-[var(--surface-2)]"
          style={{ color: "var(--text-muted)" }}
        >
          <X size={16} strokeWidth={1.8} />
        </button>
      </div>

      <div className="px-6 py-5">{children}</div>
    </dialog>
  );
}
