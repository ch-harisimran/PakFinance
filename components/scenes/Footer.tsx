import { Logo } from "@/components/brand/Logo";
import { Reveal } from "@/components/motion/Reveal";

/**
 * Every link goes somewhere real.
 *
 * The product and company columns are anchors into the sections already on this
 * page; legal are their own routes. A footer full of `href="#"` is a promise the
 * site cannot keep, and it is the first thing a careful visitor tests.
 */
const COLUMNS = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "/#features" },
      { label: "PSX", href: "/#psx" },
      { label: "Mutual Funds", href: "/#funds" },
      { label: "Goals", href: "/#goals" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "How it works", href: "/#how-it-works" },
      { label: "Security", href: "/#security" },
      { label: "Contact", href: "mailto:support@pakfinance.app" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
    ],
  },
];

export function Footer() {
  return (
    <footer
      data-scene="footer"
      data-ground="ink"
      className="relative px-5 pb-14 pt-24 sm:px-8 lg:px-12"
    >
      <div className="content-width">
        <div
          className="h-px w-full"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(201,162,39,0.35), transparent)",
          }}
          aria-hidden="true"
        />

        <Reveal className="grid gap-12 pt-16 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div>
            <Logo href={null} />
            <p className="mt-5 max-w-[30ch] text-[14.5px]" style={{ color: "var(--text-muted)" }}>
              Your finances. One view.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {COLUMNS.map((col) => (
              <div key={col.title}>
                <div
                  className="mb-5 text-[10px] uppercase tracking-[0.16em]"
                  style={{ fontFamily: "var(--font-mono)", color: "var(--text-faint)" }}
                >
                  {col.title}
                </div>
                <ul className="flex flex-col gap-3.5">
                  {col.links.map((l) => (
                    <li key={l.label}>
                      {/* inline-flex + min-height so the tap target clears the
                          24px WCAG 2.5.8 minimum. As bare inline text these were
                          19px tall — fine with a mouse, fiddly with a thumb, and
                          this footer is mostly read on a phone. */}
                      <a
                        href={l.href}
                        className="inline-flex min-h-[24px] items-center text-[14px] transition-colors duration-200 hover:text-[var(--text-primary)]"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {l.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Reveal>

        <div
          className="mt-20 flex flex-col gap-4 border-t pt-8 text-[12.5px] sm:flex-row sm:items-center sm:justify-between"
          style={{ borderColor: "var(--border-subtle)", color: "var(--text-faint)" }}
        >
          <span>© 2026 PakFinance. A personal project.</span>
          {/* The non-commercial status and the data's origin belong where every
              visitor sees them, not only on the legal pages they have to click
              into. Stated in full at the top of /terms and /privacy. */}
          <span className="max-w-[62ch] sm:text-right">
            A personal, non-commercial project — not investment advice, and not
            affiliated with PSX, MUFAP or any bank. Market data belongs to its
            sources and is used only to value holdings you enter yourself.
          </span>
        </div>
      </div>
    </footer>
  );
}
