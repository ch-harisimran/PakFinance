"use client";

import { useState, useTransition } from "react";
import { Plus, Search } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { addFundOrder, lookupFunds } from "@/app/dashboard/actions";

/**
 * Record a mutual fund order.
 *
 * The NAV field is doing double duty until the MUFAP sync exists: it records
 * the price you actually transacted at — which *is* the official NAV for that
 * date — and that becomes the price the holding is valued at. So the screen is
 * accurate from the first order, without a feed.
 */

type Match = { id: string; name: string; amc: string; category: string; isIslamic: boolean };

const TYPES: [string, string][] = [
  ["BUY", "Buy"],
  ["REDEEM", "Redeem"],
  ["DIVIDEND", "Dividend (reinvested units)"],
];

const CATEGORIES = [
  "Money Market",
  "Islamic Money Market",
  "Income",
  "Islamic Income",
  "Equity",
  "Islamic Equity",
  "Asset Allocation",
  "Index Tracker",
  "Other",
];

export function AddFundOrder() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<Match[]>([]);
  const [picked, setPicked] = useState<Match | null>(null);
  const [creating, setCreating] = useState(false);
  const [type, setType] = useState("BUY");

  function onQuery(value: string) {
    setQuery(value);
    setPicked(null);
    startTransition(async () => setMatches(await lookupFunds(value)));
  }

  function submit(formData: FormData) {
    startTransition(async () => {
      const result = await addFundOrder({}, formData);
      if (result?.ok) {
        setError(undefined);
        setQuery("");
        setPicked(null);
        setMatches([]);
        setCreating(false);
        setOpen(false);
      } else {
        setError(result?.error ?? "Something went wrong.");
      }
    });
  }

  return (
    <>
      <button
        onClick={() => {
          setOpen(true);
          startTransition(async () => setMatches(await lookupFunds("")));
        }}
        className="flex h-9 items-center gap-2 rounded-[10px] px-3.5 text-[13px] font-[550] transition-colors duration-200 hover:bg-[var(--color-brass-lit)]"
        style={{ backgroundColor: "var(--color-brass)", color: "#0A0B0D" }}
      >
        <Plus size={15} strokeWidth={2.2} />
        Add investment
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Record a fund order"
        description="NAVs are published daily by MUFAP — enter the one you transacted at."
      >
        <form action={submit} className="flex flex-col gap-4">
          {picked && <input type="hidden" name="fund_id" value={picked.id} />}

          {!creating ? (
            <div className="relative">
              <label className="mb-1.5 block text-[12.5px]" style={{ color: "var(--text-muted)" }}>
                Fund
              </label>
              <div
                className="flex h-11 items-center gap-2.5 rounded-[12px] border px-3.5 focus-within:border-[var(--color-brass)]"
                style={{ backgroundColor: "var(--surface-2)", borderColor: "var(--border-subtle)" }}
              >
                <Search size={14} strokeWidth={1.8} style={{ color: "var(--text-faint)" }} />
                <input
                  value={picked ? picked.name : query}
                  onChange={(e) => onQuery(e.target.value)}
                  placeholder="Meezan Islamic Fund"
                  autoComplete="off"
                  className="w-full bg-transparent text-[14.5px] outline-none placeholder:text-[var(--text-faint)]"
                  style={{ color: "var(--text-primary)" }}
                />
              </div>

              {!picked && matches.length > 0 && (
                <ul
                  className="absolute z-10 mt-1 max-h-[200px] w-full overflow-auto rounded-[10px] border py-1"
                  style={{ backgroundColor: "#161920", borderColor: "var(--border-subtle)" }}
                >
                  {matches.map((m) => (
                    <li key={m.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setPicked(m);
                          setMatches([]);
                        }}
                        className="w-full px-3.5 py-2 text-left hover:bg-[var(--surface-2)]"
                      >
                        <span className="block text-[13px]">{m.name}</span>
                        <span className="block text-[11px]" style={{ color: "var(--text-faint)" }}>
                          {m.amc} · {m.category}
                          {m.isIslamic ? " · Shariah" : ""}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <button
                type="button"
                onClick={() => setCreating(true)}
                className="mt-2 text-[12.5px] underline-offset-4 hover:underline"
                style={{ color: "var(--brass-text)" }}
              >
                Can&rsquo;t find it? Add the fund
              </button>
            </div>
          ) : (
            <div
              className="rounded-[12px] border p-4"
              style={{ borderColor: "var(--border-subtle)", backgroundColor: "var(--surface-1)" }}
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="text-[12.5px] font-medium">New fund</span>
                <button
                  type="button"
                  onClick={() => setCreating(false)}
                  className="text-[12px] underline underline-offset-4"
                  style={{ color: "var(--text-faint)" }}
                >
                  Back to search
                </button>
              </div>
              <div className="flex flex-col gap-3">
                <Field label="Fund name" name="new_name" placeholder="Meezan Islamic Fund" required />
                <div className="grid grid-cols-2 gap-3">
                  <Field label="AMC" name="new_amc" placeholder="Al Meezan Investments" />
                  <div>
                    <label className="mb-1.5 block text-[12.5px]" style={{ color: "var(--text-muted)" }}>
                      Category
                    </label>
                    <select
                      name="new_category"
                      className="h-11 w-full rounded-[12px] border px-3 text-[14.5px] outline-none focus:border-[var(--color-brass)]"
                      style={{
                        backgroundColor: "var(--surface-2)",
                        borderColor: "var(--border-subtle)",
                        color: "var(--text-primary)",
                      }}
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c} style={{ backgroundColor: "#111318" }}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <label
                  className="flex cursor-pointer items-center gap-2.5 text-[12.5px]"
                  style={{ color: "var(--text-muted)" }}
                >
                  <input
                    type="checkbox"
                    name="new_islamic"
                    value="1"
                    className="h-4 w-4 rounded-[5px] accent-[var(--color-brass)]"
                  />
                  Shariah-compliant
                </label>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-[12.5px]" style={{ color: "var(--text-muted)" }}>
                Type
              </label>
              <select
                name="type"
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="h-11 w-full rounded-[12px] border px-3 text-[14.5px] outline-none focus:border-[var(--color-brass)]"
                style={{
                  backgroundColor: "var(--surface-2)",
                  borderColor: "var(--border-subtle)",
                  color: "var(--text-primary)",
                }}
              >
                {TYPES.map(([v, l]) => (
                  <option key={v} value={v} style={{ backgroundColor: "#111318" }}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <Field
              label="Date"
              name="traded_at"
              type="date"
              defaultValue={new Date().toISOString().slice(0, 10)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Units" name="units" inputMode="decimal" placeholder="4200.5000" required />
            <Field
              label={type === "DIVIDEND" ? "NAV (optional)" : "NAV"}
              name="nav"
              inputMode="decimal"
              placeholder="78.42"
            />
          </div>

          {error && (
            <p className="text-[12.5px]" style={{ color: "var(--color-loss)" }}>
              {error}
            </p>
          )}

          <div className="mt-2 flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
