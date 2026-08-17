import { PageHeader } from "@/components/dashboard/PageHeader";
import { Panel } from "@/components/dashboard/Panel";
import { ZakatCalculator } from "@/components/zakat/ZakatCalculator";
import { getDashboard } from "@/lib/queries-networth";
import { getAssets, getCommittees, getZakatHistory, committeesWithPosition } from "@/lib/queries-wealth";
import { karachiNow } from "@/lib/market/sessions";
import { paisaFull } from "@/lib/money";
import { nextHawl } from "@/lib/zakat";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Zakat" };

/**
 * Zakat.
 *
 * The figures are gathered from what the user has already recorded; every
 * judgement — which metal sets the nisab, whether long-held shares count, which
 * debts may be deducted — is left as a switch, because those are matters
 * scholars answer differently and this app has no standing to decide them.
 *
 * The disclaimer is at the top, not buried at the bottom, for the same reason.
 */
export default async function ZakatPage() {
  const data = await getDashboard();
  const assets = await getAssets();
  const committeeRows = await getCommittees();
  const history = await getZakatHistory();

  const { rows: committees } = committeesWithPosition(committeeRows, karachiNow().date);

  // Money lent out is an asset to you: loans recorded as LENT rather than
  // BORROWED are receivables, not debts.
  const receivablesPaisa = data.loans
    .filter((l) => l.direction === "LENT")
    .reduce((s, l) => s + l.remainingPaisa, 0);

  const owedPaisa = data.loans
    .filter((l) => l.direction !== "LENT")
    .reduce((s, l) => s + l.remainingPaisa, 0);

  // Contributions paid into committees you have not yet collected are money
  // coming back to you; once taken, what remains is an obligation.
  const committeeAssetPaisa = committees
    .filter((c) => !c.payout_received)
    .reduce((s, c) => s + c.paidPaisa, 0);
  const committeeOwedPaisa = committees
    .filter((c) => c.payout_received)
    .reduce((s, c) => s + c.remainingPaisa, 0);

  const sources = {
    cashPaisa: data.breakdown.cashPaisa,
    stocksPaisa: data.breakdown.psxPaisa,
    fundsPaisa: data.breakdown.fundsPaisa,
    otherAssetsPaisa: assets.filter((a) => a.zakatable).reduce((s, a) => s + a.value_paisa, 0),
    receivablesPaisa,
    committeesPaisa: committeeAssetPaisa,
    shortTermDebtPaisa: owedPaisa + committeeOwedPaisa,
  };

  const last = history[0];

  return (
    <div className="flex-1 px-5 py-6 sm:px-6">
      <PageHeader
        title="Zakat"
        subtitle="Worked out from your own records, with every judgement left to you"
      />

      <div
        className="mb-5 rounded-[12px] border-l-2 px-4 py-3.5 text-[13px] leading-relaxed"
        style={{
          borderColor: "var(--color-brass)",
          backgroundColor: "var(--surface-1)",
          color: "var(--text-secondary)",
        }}
      >
        This is a calculator, not a fatwa. PakFinance adds up what you have told it
        and shows the arithmetic; it does not rule on contested questions. Scholars
        differ on whether long-held shares are assessed at market value, which debts
        may be deducted, and whether gold or silver should set the nisab — those are
        switches below, and the answers are yours and your scholar&rsquo;s.
      </div>

      <ZakatCalculator sources={sources} />

      {last && (
        <div className="mt-5 grid gap-5 xl:grid-cols-2">
          <Panel title="Previous assessments">
            <ul className="flex flex-col">
              {history.map((h) => (
                <li
                  key={h.id}
                  className="flex items-center justify-between gap-4 border-b py-3 last:border-b-0"
                  style={{ borderColor: "var(--border-subtle)" }}
                >
                  <div className="min-w-0">
                    <div className="text-[13px]">{h.assessed_on}</div>
                    <div className="mt-0.5 text-[11px]" style={{ color: "var(--text-faint)" }}>
                      on {paisaFull(h.zakatable_paisa)} · nisab {paisaFull(h.nisab_paisa)}
                    </div>
                  </div>
                  <span className="flex-none text-[13.5px] font-semibold" data-numeric>
                    {paisaFull(h.due_paisa)}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Your next hawl">
            <p className="text-[13.5px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              Zakat falls due on wealth held for one lunar year. Counting from your
              last assessment on {last.assessed_on}, that lands around{" "}
              <strong style={{ color: "var(--text-primary)" }}>
                {nextHawl(last.assessed_on)}
              </strong>
              .
            </p>
            <p className="mt-3 text-[12px] leading-relaxed" style={{ color: "var(--text-faint)" }}>
              An estimate from a 354-day lunar year, not a ruling. Many people simply
              use a fixed date in Ramadan; your own calendar is the authority.
            </p>
          </Panel>
        </div>
      )}
    </div>
  );
}
