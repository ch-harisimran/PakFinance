"use client";

import { useRef } from "react";
import { gsap, useGSAP } from "@/lib/gsap";
import { Section, SectionHead } from "@/components/layout/Section";
import { Reveal } from "@/components/motion/Reveal";
import { KeyRound, Lock, EyeOff, Download } from "lucide-react";

/**
 * Scene 10 — Security.
 *
 * Every claim names the actual mechanism. Vague security copy reads as
 * marketing; specifics read as engineering, and this is the section where a
 * finance product either earns trust or doesn't.
 */

const CLAIMS = [
  {
    Icon: KeyRound,
    title: "Secure authentication",
    body: "One-time codes are hashed before storage, expire in ten minutes, and die after five failed attempts.",
  },
  {
    Icon: Lock,
    title: "Encrypted data",
    body: "Encrypted in transit and at rest. Row-level security means a query can only ever return your own rows.",
  },
  {
    Icon: EyeOff,
    title: "No broker credentials",
    body: "PakFinance never asks for your CDC or brokerage login. There is nothing here for an attacker to steal.",
  },
  {
    Icon: Download,
    title: "Your data, portable",
    body: "Export everything to CSV or JSON whenever you like, and delete your account permanently in one step.",
  },
];

export function Security() {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const shield = root.current?.querySelector<SVGPathElement>("[data-shield]");
        if (shield) {
          const len = shield.getTotalLength();
          gsap.fromTo(
            shield,
            { strokeDasharray: len, strokeDashoffset: len },
            {
              strokeDashoffset: 0,
              ease: "none",
              scrollTrigger: { trigger: root.current, start: "top 80%", end: "bottom 70%", scrub: 0.9 },
            },
          );
        }
        gsap.to("[data-orbit]", {
          rotate: 360,
          duration: 44,
          ease: "none",
          repeat: -1,
          transformOrigin: "50% 50%",
        });
      });
      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <Section id="security" scene="security" ground="pine">
      <div className="grid gap-14 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center lg:gap-20">
        <div ref={root} className="relative mx-auto w-full max-w-[420px]">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -m-10"
            style={{
              background:
                "radial-gradient(closest-side, rgba(63,191,127,0.14), rgba(201,162,39,0.05) 55%, transparent 78%)",
            }}
          />
          <svg viewBox="0 0 220 260" className="relative block w-full" aria-hidden="true">
            <g data-orbit>
              <circle cx="110" cy="130" r="104" fill="none" stroke="var(--border-subtle)" strokeWidth="1" />
              <circle cx="110" cy="26" r="3" fill="var(--color-brass)" />
              <circle cx="214" cy="130" r="2" fill="var(--color-gain)" />
              <circle cx="110" cy="234" r="2.5" fill="var(--color-brass)" />
            </g>
            <path
              d="M110 18 L196 54 V132 C196 186 158 224 110 242 C62 224 24 186 24 132 V54 Z"
              fill="rgba(255,255,255,0.03)"
              stroke="var(--border-subtle)"
              strokeWidth="1"
            />
            <path
              data-shield
              d="M110 18 L196 54 V132 C196 186 158 224 110 242 C62 224 24 186 24 132 V54 Z"
              fill="none"
              stroke="var(--color-brass)"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            <rect x="88" y="122" width="44" height="36" rx="6" fill="none" stroke="var(--color-brass)" strokeWidth="2" />
            <path d="M97 122 V110 a13 13 0 0 1 26 0 V122" fill="none" stroke="var(--color-brass)" strokeWidth="2" />
          </svg>
        </div>

        <div>
          <SectionHead
            eyebrow="Security & privacy"
            headline={
              <>
                Your financial data <span style={{ color: "var(--text-muted)" }}>deserves privacy.</span>
              </>
            }
            className="mb-12"
          />

          <Reveal stagger={0.1} className="grid gap-x-8 gap-y-9 sm:grid-cols-2">
            {CLAIMS.map((c) => (
              <div key={c.title}>
                <div
                  className="mb-4 grid h-10 w-10 place-items-center rounded-[11px] border"
                  style={{ backgroundColor: "var(--surface-1)", borderColor: "var(--border-subtle)" }}
                >
                  <c.Icon size={17} strokeWidth={1.6} color="var(--brass-text)" />
                </div>
                <div className="mb-2 text-[15.5px] font-semibold tracking-[-0.01em]">{c.title}</div>
                <p className="text-[13.5px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
                  {c.body}
                </p>
              </div>
            ))}
          </Reveal>
        </div>
      </div>
    </Section>
  );
}
