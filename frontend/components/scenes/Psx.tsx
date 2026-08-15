"use client";

import { Section, SectionHead } from "@/components/layout/Section";
import { Reveal } from "@/components/motion/Reveal";
import { CountUp } from "@/components/motion/CountUp";

/**
 * Scene 04 — PSX portfolio.
 *
 * Deliberately not a trading terminal: no order book, no depth chart, no
 * candlesticks. Generous padding, large type, one sparkline. It should read as
 * a personal tracker that happens to know the market.
 */

const ROWS = [
  { sym: "OGDC", name: "Oil & Gas Dev.", qty: "1,200", px: "218.40", pct: 12.4, up: true },
  { sym: "MEBL", name: "Meezan Bank", qty: "800", px: "287.10", pct: 8.7, up: true },
  { sym: "LUCK", name: "Lucky Cement", qty: "150", px: "1,042.75", pct: 15.2, up: true },
  { sym: "HBL", name: "Habib Bank", qty: "2,000", px: "154.20", pct: 6.8, up: true },
  { sym: "ENGRO", name: "Engro Corp.", qty: "450", px: "318.65", pct: -1.4, up: false },
];

export function Psx() {
  return (
    <Section scene="psx" ground="warm">
      <div className="grid gap-14 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] lg:items-center lg:gap-16">
        <SectionHead
          eyebrow="Pakistan Stock Exchange"
          headline={
            <>
              Your PSX portfolio, <span style={{ color: "var(--text-muted)" }}>always within reach.</span>
            </>
          }
          lede="Track your holdings, portfolio value, and performance without jumping between spreadsheets and websites. Prices refresh through the trading session and freeze when the market closes."
        />

        <Reveal y={40}>
          <div className="card overflow-hidden">
            <div
              className="flex items-center justify-between border-b px-6 py-5"
              style={{ borderColor: "var(--border-subtle)" }}
            >
              <div>
                <div
                  className="mb-1.5 text-[10px] uppercase tracking-[0.16em]"
                  style={{ fontFamily: "var(--font-mono)", color: "var(--text-faint)" }}
                >
                  Portfolio value
                </div>
                <div className="flex items-baseline text-[26px] font-semibold leading-none tracking-[-0.025em]">
                  <span className="currency">PKR</span>
                  <CountUp value={1650000} />
                </div>
              </div>
              <div
                className="flex items-center gap-2 text-[10px] uppercase tracking-[0.12em]"
                style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}
              >
                <span
                  className="h-1.5 w-1.5 animate-pulse rounded-full"
                  style={{ backgroundColor: "var(--color-gain)" }}
                />
                Market open {"·"} 15:12 PKT
              </div>
            </div>

            <div
              className="grid grid-cols-[1fr_auto_auto] gap-4 px-6 py-3 text-[9.5px] uppercase tracking-[0.14em]"
              style={{ fontFamily: "var(--font-mono)", color: "var(--text-faint)" }}
            >
              <span>Scrip</span>
              <span className="text-right">Last</span>
              <span className="w-[68px] text-right">Return</span>
            </div>

            <Reveal stagger={0.07}>
              {ROWS.map((r) => (
                <div
                  key={r.sym}
                  className="grid grid-cols-[1fr_auto_auto] items-center gap-4 border-t px-6 py-4 transition-colors duration-200 hover:bg-[var(--surface-1)]"
                  style={{ borderColor: "var(--border-subtle)" }}
                  data-numeric
                >
                  <div className="min-w-0">
                    <div
                      className="text-[13.5px] font-medium"
                      style={{ fontFamily: "var(--font-mono)", color: "var(--text-primary)" }}
                    >
                      {r.sym}
                    </div>
                    <div className="truncate text-[11.5px]" style={{ color: "var(--text-faint)" }}>
                      {r.name} {"·"} {r.qty} shares
                    </div>
                  </div>
                  <div className="text-[14px]" style={{ color: "var(--text-secondary)" }}>
                    {r.px}
                  </div>
                  <div
                    className="w-[68px] text-right text-[14px] font-semibold"
                    style={{ color: r.up ? "var(--color-gain)" : "var(--color-loss)" }}
                  >
                    {r.up ? "+" : "−"}
                    {Math.abs(r.pct)}%
                  </div>
                </div>
              ))}
            </Reveal>

            <div
              className="border-t px-6 py-4 text-[11.5px]"
              style={{ borderColor: "var(--border-subtle)", color: "var(--text-faint)" }}
            >
              Weighted-average cost basis, with brokerage and CDC charges included.
            </div>
          </div>
        </Reveal>
      </div>
    </Section>
  );
}
