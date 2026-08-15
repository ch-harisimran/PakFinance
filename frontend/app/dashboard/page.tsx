import { ChevronLeft, ChevronRight } from "lucide-react";
import { NetWorthHero } from "@/components/dashboard/NetWorthHero";
import { BalanceSheet } from "@/components/dashboard/BalanceSheet";
import { Attention } from "@/components/dashboard/Attention";
import {
  Holdings,
  FundsPanel,
  CashFlow,
  Expenses,
  Transactions,
  GoalsPanel,
} from "@/components/dashboard/Panels";
import { MARKET_OPEN } from "@/lib/dashboard-data";

/**
 * Three zones with deliberately unequal weight:
 *
 *   1  the answer      net worth at display scale, balance sheet beside it
 *   2  what needs you  the only things here with a deadline
 *   3  the detail      holdings, funds, flows — denser, lower contrast
 *
 * The reference laid fourteen cards out at identical weight, so nothing led.
 */
export default function DashboardPage() {
  return (
    <div className="flex-1 px-5 py-6 sm:px-6">
      {/* Greeting + period control */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2
            className="text-[clamp(1.5rem,2.4vw,2rem)] leading-tight tracking-[-0.02em]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Good evening, Haris
          </h2>
          <p className="mt-1.5 text-[13.5px]" style={{ color: "var(--text-muted)" }}>
            {MARKET_OPEN ? "PSX is open · closes 15:30 PKT" : "PSX is closed · reopens 09:32 PKT"}
          </p>
        </div>

        {/*
          Governs the flow cards only — cash flow and expenses. Balances are
          "as of now" and carry their own stamp, because asking what your net
          worth was *for* August is not a question with an answer.
        */}
        <div className="flex items-center gap-3">
          <span
            className="hidden text-[11px] uppercase tracking-[0.12em] sm:block"
            style={{ fontFamily: "var(--font-mono)", color: "var(--text-faint)" }}
          >
            Cash flow period
          </span>
          <div
            className="flex items-center gap-1 rounded-[10px] border p-1"
            style={{ borderColor: "var(--border-subtle)" }}
          >
            <button
              aria-label="Previous month"
              className="grid h-7 w-7 place-items-center rounded-[7px] transition-colors duration-200 hover:bg-[var(--surface-2)]"
              style={{ color: "var(--text-muted)" }}
            >
              <ChevronLeft size={14} strokeWidth={1.8} />
            </button>
            <span className="px-2 text-[13px] font-medium">August 2026</span>
            <button
              aria-label="Next month"
              className="grid h-7 w-7 place-items-center rounded-[7px] transition-colors duration-200 hover:bg-[var(--surface-2)]"
              style={{ color: "var(--text-muted)" }}
            >
              <ChevronRight size={14} strokeWidth={1.8} />
            </button>
          </div>
        </div>
      </div>

      {/* Zone 1 — the answer */}
      <div className="mb-5 grid gap-5 xl:grid-cols-[minmax(0,1.75fr)_minmax(0,1fr)]">
        <NetWorthHero />
        <BalanceSheet />
      </div>

      {/* Zone 2 — what needs you */}
      <div className="mb-5">
        <Attention />
      </div>

      {/* Zone 3 — the detail */}
      <div className="grid gap-5 xl:grid-cols-3">
        <Holdings />
        <FundsPanel />
        <CashFlow />
        <Expenses />
        <Transactions />
        <GoalsPanel />
      </div>
    </div>
  );
}
