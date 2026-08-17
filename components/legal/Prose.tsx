import type { ReactNode } from "react";

/**
 * Typography for the legal pages.
 *
 * Shared so Privacy and Terms cannot drift apart, and so the reading measure is
 * set once. Nothing here is decorative: these documents are read by people who
 * are worried, and the job is to be legible.
 */

export function LegalTitle({ title, updated }: { title: string; updated: string }) {
  return (
    <div className="mb-10">
      <h1
        className="text-[clamp(1.8rem,4vw,2.4rem)] leading-[1.15] tracking-[-0.03em]"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {title}
      </h1>
      <p className="mt-3 text-[13px]" style={{ color: "var(--text-faint)" }}>
        Last updated {updated}
      </p>
    </div>
  );
}

export function Section({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section className="mb-9">
      <h2 className="mb-3 text-[16px] font-semibold tracking-[-0.01em]">{heading}</h2>
      <div className="flex flex-col gap-3.5 text-[14.5px] leading-[1.75]" style={{ color: "var(--text-secondary)" }}>
        {children}
      </div>
    </section>
  );
}

export function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-col gap-2.5 pl-1">
      {items.map((item) => (
        <li key={item} className="flex gap-3">
          <span aria-hidden="true" style={{ color: "var(--brass-text)" }}>
            —
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

/** Pulled out of the flow, for the points that matter most. */
export function Callout({ children }: { children: ReactNode }) {
  return (
    <div
      className="rounded-[12px] border-l-2 px-4 py-3.5 text-[14px] leading-[1.7]"
      style={{
        borderColor: "var(--color-brass)",
        backgroundColor: "var(--surface-1)",
        color: "var(--text-primary)",
      }}
    >
      {children}
    </div>
  );
}
