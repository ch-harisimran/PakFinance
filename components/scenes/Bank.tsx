"use client";

import { Section, SectionHead } from "@/components/layout/Section";
import { Reveal } from "@/components/motion/Reveal";
import { CountUp } from "@/components/motion/CountUp";

/**
 * Scene 08 — Bank accounts.
 *
 * Transactions materialise one at a time rather than arriving as a table.
 *
 * Credits are `gain`; debits are plain primary text — deliberately *not*
 * `loss`. Paying your rent is not a loss, and spending the red here would
 * destroy its meaning everywhere else on the page.
 */

const TXNS = [
  { label: "Salary", sub: "Monthly credit", amount: "+100,000", credit: true },
  { label: "Rent", sub: "Standing instruction", amount: "−25,000", credit: false },
  { label: "Groceries", sub: "Card {} Imtiaz", amount: "−8,500", credit: false },
  { label: "Utilities", sub: "K-Electric", amount: "−5,000", credit: false },
];

export function Bank() {
  return (
    <Section scene="bank" ground="slate">
      <div className="grid gap-14 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-center lg:gap-16">
        <Reveal y={40} className="order-2 lg:order-1">
          <div className="card overflow-hidden">
            <div
              className="border-b px-6 py-6"
              style={{ borderColor: "var(--border-subtle)" }}
            >
              <div className="mb-4 flex items-center justify-between">
                <div
                  className="text-[10px] uppercase tracking-[0.16em]"
                  style={{ fontFamily: "var(--font-mono)", color: "var(--text-faint)" }}
                >
                  Meezan Bank {"·"} ****4471
                </div>
                <div
                  className="text-[10px] uppercase tracking-[0.12em]"
                  style={{ fontFamily: "var(--font-mono)", color: "var(--text-faint)" }}
                >
                  Current
                </div>
              </div>
              <div className="flex items-baseline text-[clamp(28px,3.4vw,40px)] font-semibold leading-none tracking-[-0.025em]">
                <span className="currency">PKR</span>
                <CountUp value={350000} />
              </div>
            </div>

            <Reveal stagger={0.14}>
              {TXNS.map((t) => (
                <div
                  key={t.label}
                  className="flex items-center justify-between border-t px-6 py-[18px]"
                  style={{ borderColor: "var(--border-subtle)" }}
                >
                  <div>
                    <div className="text-[14.5px] font-medium">{t.label}</div>
                    <div className="mt-1 text-[11.5px]" style={{ color: "var(--text-faint)" }}>
                      {t.sub.replace("{}", "·")}
                    </div>
                  </div>
                  <div
                    className="text-[15px] font-semibold tracking-[-0.01em]"
                    style={{ color: t.credit ? "var(--color-gain)" : "var(--text-primary)" }}
                    data-numeric
                  >
                    {t.amount}
                  </div>
                </div>
              ))}
            </Reveal>
          </div>
        </Reveal>

        <SectionHead
          eyebrow="Bank accounts"
          headline={
            <>
              Your money, <span style={{ color: "var(--text-muted)" }}>clearly accounted for.</span>
            </>
          }
          lede="Log balances and movements across every account you hold. No bank credentials, no screen-scraping, no third party sitting between you and your money — you enter what you choose to track."
          className="order-1 lg:order-2"
        />
      </div>
    </Section>
  );
}
