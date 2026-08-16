"use client";

import { useState, useTransition, type ReactNode } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { submitting } from "@/lib/form";
import type { FormState } from "@/app/dashboard/actions";

/**
 * The body every record dialog shares: a form, an error line, and a
 * pending-aware submit.
 *
 * Controlled rather than owning its own trigger, because the two callers open
 * it from different places — the Add flows from a header button, the Edit flows
 * from a row menu. Extracted when the second one appeared rather than the third,
 * since the submit semantics below are subtle enough that two copies would drift.
 *
 * Submitting through a transition rather than useActionState: the dialog should
 * close only on success, and driving that from an effect on the action state
 * causes a cascading render. Here the decision happens where the result arrives.
 */
export function FormShell({
  open,
  onClose,
  title,
  description,
  action,
  submitLabel = "Save",
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  action: (prev: FormState, form: FormData) => Promise<FormState>;
  submitLabel?: string;
  children: ReactNode;
}) {
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  // A stale error must not greet the user the next time the dialog opens.
  function close() {
    setError(undefined);
    onClose();
  }

  // `submitting` rather than `action={submit}`: React resets an uncontrolled
  // form when an action returns, error or not, which is what made a rejected
  // field wipe every other one the user had just filled in. See lib/form.ts.
  function submit(formData: FormData) {
    startTransition(async () => {
      const result = await action({}, formData);
      if (result?.ok) {
        close();
      } else {
        setError(result?.error ?? "Something went wrong.");
      }
    });
  }

  return (
    <Modal open={open} onClose={close} title={title} description={description}>
      <form onSubmit={submitting(submit)} className="flex flex-col gap-4">
        {children}

        {error && (
          <p className="text-[12.5px]" style={{ color: "var(--color-loss)" }} role="alert">
            {error}
          </p>
        )}

        <div className="mt-2 flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? "Saving…" : submitLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
