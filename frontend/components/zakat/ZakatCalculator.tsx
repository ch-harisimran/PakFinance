"use client";

import { useMemo, useState, useTransition } from "react";
import { Panel } from "@/components/dashboard/Panel";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { saveZakatAssessment } from "@/app/dashboard/actions";
import { calculateZakat, NISAB_GOLD_GRAMS, NISAB_SILVER_GRAMS, type NisabBasis } from "@/lib/zakat";
import { paisaFull } from "@/lib/money";
import { submitting } from "@/lib/form";

/**
 * The Zakat calculator.
 *
 * Deliberately shows its working line by line. Someone is going to pay real
 * money on the strength of this number, and a single total they cannot check is
 * worth much less than a total they can follow.
 *
 * The metal price is an input, not a fetched figure: there is no gold price feed
 * here, and the nisab is the threshold that decides whether anything is owed at
 * all. Guessing it would be the worst possible thing to guess.
 */

export interface ZakatSources {
  cashPaisa: number;
  stocksPaisa: number;
  fundsPaisa: number;
  otherAssetsPaisa: number;
  receivablesPaisa: number;
  committeesPaisa: number;
  shortTermDebtPaisa: number;
}

export function ZakatCalculator({ sources }: { sources: ZakatSources }) {
  const [basis, setBasis] = useState<NisabBasis>("gold");
  const [pricePerGram, setPricePerGram] = useState("");
  const [deductDebt, setDeductDebt] = useState(true);
  const [include, setInclude] = useState({
    cash: true,
    stocks: true,
    funds: true,
    assets: true,
    receivables: true,
    committees: true,
  });

  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const result = useMemo(
    () =>
      calculateZakat({
        cashPaisa: include.cash ? sources.cashPaisa : 0,
        stocksPaisa: include.stocks ? sources.stocksPaisa : 0,
        fundsPaisa: include.funds ? sources.fundsPaisa : 0,
        otherAssetsPaisa: include.assets ? sources.otherAssetsPaisa : 0,
        receivablesPaisa: include.receivables ? sources.receivablesPaisa : 0,
        committeesPaisa: include.committees ? sources.committeesPaisa : 0,
        deductionsPaisa: deductDebt ? sources.shortTermDebtPaisa : 0,
        metalPricePerGramPaisa: Math.round((Number(pricePerGram) || 0) * 100),
        basis,
      }),
    [sources, include, deductDebt, pricePerGram, basis],
  );

  function save(form: FormData) {
    startTransition(async () => {
      const outcome = await saveZakatAssessment({}, form);
      setError(outcome.ok ? undefined : (outcome.error ?? "Could not save."));
      setSaved(!!outcome.ok);
    });
  }

  const grams = basis === "gold" ? NISAB_GOLD_GRAMS : NISAB_SILVER_GRAMS;

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
      <Panel title="What you hold" subtitle="Every figure comes from your own records">
        <ul className="flex flex-col">
          {(
            [
              ["cash", "Cash and bank balances", sources.cashPaisa, null],
              ["stocks", "Shares at market value", sources.stocksPaisa,
                "Some scholars assess only the zakatable assets underlying a long-held share."],
              ["funds", "Mutual fund units", sources.fundsPaisa, null],
              ["assets", "Gold, silver and other marked assets", sources.otherAssetsPaisa,
                "Marked one by one on the Other Assets screen."],
              ["receivables", "Money lent out", sources.receivablesPaisa,
                "Debts you doubt you will recover are usually excluded until received."],
              ["committees", "Committee contributions not yet taken", sources.committeesPaisa, null],
            ] as const
          ).map(([key, label, amount, note]) => (
            <li
              key={key}
              className="flex items-start justify-between gap-4 border-b py-3.5 last:border-b-0"
              style={{ borderColor: "var(--border-subtle)" }}
            >
              {/* The box itself is 16px; the label is the target, and rows
                  without a note would otherwise come out 21px tall — under the
                  24px WCAG 2.5.8 minimum. */}
              <label className="flex min-h-[24px] min-w-0 cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={include[key]}
                  onChange={(e) => setInclude((s) => ({ ...s, [key]: e.target.checked }))}
                  className="mt-0.5 h-4 w-4 flex-none rounded-[5px] accent-[var(--color-brass)]"
                />
                <span className="min-w-0">
                  <span className="block text-[13px]">{label}</span>
                  {note && (
                    <span className="mt-0.5 block text-[11px]" style={{ color: "var(--text-faint)" }}>
                      {note}
                    </span>
                  )}
                </span>
              </label>
              <span
                className="flex-none text-[13.5px] font-semibold"
                style={{ color: include[key] ? "var(--text-primary)" : "var(--text-faint)" }}
                data-numeric
              >
                {paisaFull(amount)}
              </span>
            </li>
          ))}

          <li
            className="flex items-start justify-between gap-4 border-t py-3.5"
            style={{ borderColor: "var(--border-subtle)" }}
          >
            <label className="flex min-h-[24px] min-w-0 cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={deductDebt}
                onChange={(e) => setDeductDebt(e.target.checked)}
                className="mt-0.5 h-4 w-4 flex-none rounded-[5px] accent-[var(--color-brass)]"
              />
              <span className="min-w-0">
                <span className="block text-[13px]">Deduct what you owe</span>
                <span className="mt-0.5 block text-[11px]" style={{ color: "var(--text-faint)" }}>
                  Outstanding loans and committee obligations. Which debts may be
                  deducted is itself a question scholars answer differently.
                </span>
              </span>
            </label>
            <span
              className="flex-none text-[13.5px] font-semibold"
              style={{ color: deductDebt ? "var(--color-loss)" : "var(--text-faint)" }}
              data-numeric
            >
              −{paisaFull(sources.shortTermDebtPaisa)}
            </span>
          </li>
        </ul>
      </Panel>

      <div className="flex flex-col gap-5">
        <Panel title="Nisab" subtitle="The threshold below which nothing is due">
          <div
            className="mb-4 flex gap-0.5 rounded-[10px] border p-1"
            style={{ borderColor: "var(--border-subtle)" }}
          >
            {(
              [
                ["gold", "Gold"],
                ["silver", "Silver"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setBasis(key)}
                className="flex-1 rounded-[7px] px-3 py-2 text-[12.5px] transition-colors duration-200"
                style={{
                  backgroundColor: basis === key ? "var(--surface-3)" : "transparent",
                  color: basis === key ? "var(--text-primary)" : "var(--text-muted)",
                }}
              >
                {label}
              </button>
            ))}
          </div>

          <Field
            label={`Price per gram of ${basis} (PKR)`}
            value={pricePerGram}
            onChange={(e) => setPricePerGram(e.target.value)}
            inputMode="decimal"
            placeholder={basis === "gold" ? "30000" : "350"}
            hint={`Nisab is ${grams}g. Today's rate is yours to supply — there is no metal price feed here.`}
          />

          <div
            className="mt-4 flex items-baseline justify-between border-t pt-3.5 text-[13px]"
            style={{ borderColor: "var(--border-subtle)" }}
          >
            <span style={{ color: "var(--text-muted)" }}>Nisab works out at</span>
            <span className="font-semibold" data-numeric>
              {result.nisabPaisa ? paisaFull(result.nisabPaisa) : "—"}
            </span>
          </div>

          {basis === "silver" && (
            <p className="mt-3 text-[11.5px]" style={{ color: "var(--text-faint)" }}>
              The silver threshold is far lower, so it catches more people. Many
              scholars prefer it for exactly that reason; others prefer gold. This is
              your choice to make.
            </p>
          )}
        </Panel>

        <Panel title="What is due">
          <div className="flex flex-col gap-2.5 text-[13px]">
            <Line label="Total counted" value={paisaFull(result.assetsPaisa)} />
            <Line label="Less debts" value={`−${paisaFull(result.deductionsPaisa)}`} />
            <div className="border-t pt-2.5" style={{ borderColor: "var(--border-subtle)" }}>
              <Line label="Zakatable wealth" value={paisaFull(result.zakatablePaisa)} strong />
            </div>
          </div>

          {!result.nisabPaisa ? (
            <p className="mt-5 text-[12.5px]" style={{ color: "var(--text-muted)" }}>
              Enter today&rsquo;s {basis} price above to see whether you reach nisab.
            </p>
          ) : result.meetsNisab ? (
            <>
              <div className="mt-5">
                <div
                  className="mb-1.5 text-[10px] uppercase tracking-[0.13em]"
                  style={{ fontFamily: "var(--font-mono)", color: "var(--text-faint)" }}
                >
                  Zakat at 2.5%
                </div>
                <div className="flex items-baseline text-[30px] font-semibold leading-none tracking-[-0.03em]">
                  <span className="currency">PKR</span>
                  <span data-numeric>{paisaFull(result.duePaisa)}</span>
                </div>
              </div>

              <form method="post" onSubmit={submitting(save)} className="mt-5">
                <input type="hidden" name="nisab_paisa" value={result.nisabPaisa} />
                <input type="hidden" name="assets_paisa" value={result.assetsPaisa} />
                <input type="hidden" name="deductions_paisa" value={result.deductionsPaisa} />
                <input type="hidden" name="zakatable_paisa" value={result.zakatablePaisa} />
                <input type="hidden" name="due_paisa" value={result.duePaisa} />

                {error && (
                  <p className="mb-3 text-[12.5px]" style={{ color: "var(--color-loss)" }} role="alert">
                    {error}
                  </p>
                )}

                <div className="flex items-center gap-3">
                  <Button type="submit" variant="secondary" disabled={pending}>
                    {pending ? "Saving…" : "Record this assessment"}
                  </Button>
                  {saved && !pending && (
                    <span className="text-[12.5px]" style={{ color: "var(--color-gain)" }}>
                      Recorded
                    </span>
                  )}
                </div>
              </form>
            </>
          ) : (
            <p className="mt-5 text-[12.5px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
              Your zakatable wealth is below nisab, so no Zakat is due on it. You are{" "}
              <span style={{ color: "var(--text-primary)" }} data-numeric>
                {paisaFull(result.nisabPaisa - result.zakatablePaisa)}
              </span>{" "}
              below the threshold.
            </p>
          )}
        </Panel>
      </div>
    </div>
  );
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span style={{ color: strong ? "var(--text-primary)" : "var(--text-muted)" }}>{label}</span>
      <span className={strong ? "font-semibold" : ""} data-numeric>
        {value}
      </span>
    </div>
  );
}
