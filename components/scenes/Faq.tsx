"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Section, SectionHead } from "@/components/layout/Section";
import { Reveal } from "@/components/motion/Reveal";

/**
 * Scene 12 — FAQ.
 *
 * Height animates via `grid-template-rows: 0fr → 1fr`, which transitions
 * smoothly without measuring content or hardcoding a max-height that clips long
 * answers. The panel stays in the DOM and is hidden with `visibility` so it
 * remains findable by in-page search but stays out of the tab order.
 */

const QA = [
  {
    q: "Where do the PSX prices come from?",
    a: "Prices are pulled from the Pakistan Stock Exchange's public data feed on a schedule during market hours and stored on our side, so the app reads one consistent source rather than hammering an external site. Quotes are delayed rather than tick-by-tick real time.",
  },
  {
    q: "Do mutual fund NAVs update live?",
    a: "No — and any app that claims otherwise is misleading you. MUFAP publishes NAVs once per day, after the close. PakFinance syncs them each evening and stamps every value with the date it was priced.",
  },
  {
    q: "Do you need my bank or brokerage login?",
    a: "Never. PakFinance has no credential field for your bank, broker or CDC account, and no integration that would use one. You enter what you want to track, or import a CSV. There is nothing here for an attacker to take.",
  },
  {
    q: "Is my financial data private?",
    a: "Every table is protected by row-level security, so a query can only ever return rows belonging to your account. Data is encrypted in transit and at rest, and you can export or permanently delete everything at any time.",
  },
  {
    q: "Is this investment advice?",
    a: "No. PakFinance is a tracking tool. It shows you what you own, what you owe and how it has moved. It does not recommend securities, forecast returns, or tell you what to buy — and it never will.",
  },
  {
    q: "What does it cost?",
    a: "The core tracker is free while we are in early access. If paid tiers arrive later, everything you have already entered stays yours and stays exportable.",
  },
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <Section id="faq" scene="faq" ground="ink">
      <div className="grid gap-12 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)] lg:gap-20">
        <SectionHead
          eyebrow="Questions"
          headline={
            <>
              Straight <span style={{ color: "var(--text-muted)" }}>answers.</span>
            </>
          }
        />

        <Reveal stagger={0.06}>
          {QA.map((item, i) => {
            const isOpen = open === i;
            return (
              <div key={item.q} className="border-b" style={{ borderColor: "var(--border-subtle)" }}>
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  aria-expanded={isOpen}
                  className="flex w-full items-start justify-between gap-6 py-6 text-left transition-colors duration-200"
                >
                  <span
                    className="text-[clamp(15.5px,1.5vw,18px)] font-medium tracking-[-0.01em]"
                    style={{ color: isOpen ? "var(--text-primary)" : "var(--text-secondary)" }}
                  >
                    {item.q}
                  </span>
                  <Plus
                    size={18}
                    strokeWidth={1.6}
                    className="mt-1 flex-none transition-transform duration-300 [transition-timing-function:var(--ease-out)]"
                    style={{
                      color: isOpen ? "var(--brass-text)" : "var(--text-faint)",
                      transform: isOpen ? "rotate(135deg)" : "rotate(0deg)",
                    }}
                  />
                </button>
                <div
                  className="grid transition-[grid-template-rows,opacity] duration-400 [transition-timing-function:var(--ease-out)]"
                  style={{
                    gridTemplateRows: isOpen ? "1fr" : "0fr",
                    opacity: isOpen ? 1 : 0,
                    visibility: isOpen ? "visible" : "hidden",
                  }}
                >
                  <div className="overflow-hidden">
                    <p
                      className="max-w-[62ch] pb-7 pr-8 text-[14.5px] leading-relaxed"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {item.a}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </Reveal>
      </div>
    </Section>
  );
}
