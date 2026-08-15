"use client";

import { useState, useTransition } from "react";
import { Plus, Search } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { addTrade, lookupSymbols } from "@/app/dashboard/actions";

/**
 * Add a PSX transaction.
 *
 * The symbol field autocompletes against `market.securities` — the real 495
 * symbols the sync discovered — so a user cannot invent a ticker. The foreign
 * key would reject one anyway, but catching it here gives a useful message
 * instead of a database error.
 */

const TYPES: [string, string][] = [
  ["BUY", "Buy"],
  ["SELL", "Sell"],
  ["DIVIDEND", "Dividend"],
  ["BONUS", "Bonus shares"],
  ["RIGHT", "Right shares"],
];

export function AddTrade() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const [symbol, setSymbol] = useState("");
  const [matches, setMatches] = useState<{ symbol: string; kind: string }[]>([]);
  const [type, setType] = useState("BUY");

  function onSymbolChange(value: string) {
    const v = value.toUpperCase();
    setSymbol(v);
    startTransition(async () => {
      setMatches(v.length ? await lookupSymbols(v) : []);
    });
  }

  function submit(formData: FormData) {
    startTransition(async () => {
      const result = await addTrade({}, formData);
      if (result?.ok) {
        setError(undefined);
        setSymbol("");
        setMatches([]);
        setOpen(false);
      } else {
        setError(result?.error ?? "Something went wrong.");
      }
    });
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex h-9 items-center gap-2 rounded-[10px] px-3.5 text-[13px] font-[550] transition-colors duration-200 hover:bg-[var(--color-brass-lit)]"
        style={{ backgroundColor: "var(--color-brass)", color: "#0A0B0D" }}
      >
        <Plus size={15} strokeWidth={2.2} />
        Add transaction
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Add a PSX transaction"
        description="Weighted-average cost basis, including brokerage and CDC charges."
      >
        <form action={submit} className="flex flex-col gap-4">
          <div className="relative">
            <label className="mb-1.5 block text-[12.5px]" style={{ color: "var(--text-muted)" }}>
              Scrip
            </label>
            <div
              className="flex h-11 items-center gap-2.5 rounded-[12px] border px-3.5 focus-within:border-[var(--color-brass)]"
              style={{ backgroundColor: "var(--surface-2)", borderColor: "var(--border-subtle)" }}
            >
              <Search size={14} strokeWidth={1.8} style={{ color: "var(--text-faint)" }} />
              <input
                name="symbol"
                value={symbol}
                onChange={(e) => onSymbolChange(e.target.value)}
                placeholder="OGDC"
                autoComplete="off"
                required
                className="w-full bg-transparent text-[14.5px] uppercase outline-none placeholder:normal-case placeholder:text-[var(--text-faint)]"
                style={{ color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}
              />
            </div>

            {matches.length > 0 && (
              <ul
                className="absolute z-10 mt-1 max-h-[190px] w-full overflow-auto rounded-[10px] border py-1"
                style={{ backgroundColor: "#161920", borderColor: "var(--border-subtle)" }}
              >
                {matches.map((m) => (
                  <li key={m.symbol}>
                    <button
                      type="button"
                      onClick={() => {
                        setSymbol(m.symbol);
                        setMatches([]);
                      }}
                      className="flex w-full items-center justify-between px-3.5 py-2 text-left text-[13px] hover:bg-[var(--surface-2)]"
                    >
                      <span style={{ fontFamily: "var(--font-mono)" }}>{m.symbol}</span>
                      <span className="text-[10.5px]" style={{ color: "var(--text-faint)" }}>
                        {m.kind}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

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
            <Field label="Date" name="traded_at" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field
              label={type === "DIVIDEND" ? "Shares held" : "Quantity"}
              name="quantity"
              inputMode="decimal"
              placeholder="1000"
              required
            />
            <Field
              label={
                type === "DIVIDEND"
                  ? "Dividend per share"
                  : type === "BONUS"
                    ? "Price (leave blank)"
                    : "Price per share"
              }
              name="price"
              inputMode="decimal"
              placeholder={type === "BONUS" ? "0" : "218.40"}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Brokerage" name="commission" inputMode="decimal" placeholder="620" />
            <Field label="Other charges" name="charges" inputMode="decimal" placeholder="0" hint="CDC, FED" />
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
