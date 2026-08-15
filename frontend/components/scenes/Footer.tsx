import { Logo } from "@/components/brand/Logo";
import { Reveal } from "@/components/motion/Reveal";

const COLUMNS = [
  {
    title: "Product",
    links: ["Features", "PSX", "Mutual Funds", "Goals"],
  },
  {
    title: "Company",
    links: ["About", "Security", "Contact"],
  },
  {
    title: "Legal",
    links: ["Privacy", "Terms"],
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
                    <li key={l}>
                      <a
                        href="#"
                        className="text-[14px] transition-colors duration-200 hover:text-[var(--text-primary)]"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {l}
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
          <span>© 2026 PakFinance. All rights reserved.</span>
          <span className="max-w-[52ch] sm:text-right">
            PakFinance is a personal finance tracking tool and does not provide
            investment advice.
          </span>
        </div>
      </div>
    </footer>
  );
}
