import { Gem } from "lucide-react";
import { PageHeader, StatRow } from "@/components/dashboard/PageHeader";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { RowActions } from "@/components/dashboard/RowActions";
import { NoMatches } from "@/components/dashboard/SearchBox";
import { AddAsset, AssetFields } from "@/components/forms/WealthForms";
import { updateAsset } from "@/app/dashboard/actions";
import { getAssets } from "@/lib/queries-wealth";
import { getNotation } from "@/lib/queries";
import { filterBy, readQuery } from "@/lib/search";
import { karachiNow } from "@/lib/market/sessions";
import { paisaFull, formatPct } from "@/lib/money";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Other Assets" };

/**
 * Other assets — gold above all.
 *
 * Gold is how a great many Pakistani households actually hold wealth, and until
 * now the app had nowhere to put it while the landing page showed it in the
 * allocation ring. Values are user-maintained and dated, because there is no
 * gold or property price feed and a made-up one would be worse than an honest
 * manual number.
 */

const LABELS: Record<string, string> = {
  GOLD: "Gold",
  SILVER: "Silver",
  PROPERTY: "Property",
  VEHICLE: "Vehicle",
  CRYPTO: "Crypto",
  FOREIGN_CURRENCY: "Foreign currency",
  OTHER: "Other",
};

export default async function AssetsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const assets = await getAssets();
  const notation = await getNotation();
  const q = readQuery((await searchParams).q);
  const shown = filterBy(assets, q, (a) => [a.name, LABELS[a.kind] ?? a.kind, a.unit, a.note]);

  const total = assets.reduce((s, a) => s + a.value_paisa, 0);
  const cost = assets.reduce((s, a) => s + (a.cost_paisa ?? 0), 0);
  const zakatable = assets.filter((a) => a.zakatable).reduce((s, a) => s + a.value_paisa, 0);
  const gain = cost > 0 ? total - cost : 0;

  // Anything not revalued in six months is worth flagging: a stale gold price is
  // a wrong net worth, and it degrades quietly.
  //
  // Compared as date strings against the app's own Karachi clock, which is what
  // `as_of` is recorded in — and avoids reading the wall clock mid-render.
  const cutoff = new Date(Date.parse(`${karachiNow().date}T00:00:00Z`) - 182 * 864e5)
    .toISOString()
    .slice(0, 10);
  const stale = assets.filter((a) => a.as_of < cutoff).length;

  if (!assets.length) {
    return (
      <div className="flex-1 px-5 py-6 sm:px-6">
        <PageHeader
          title="Other Assets"
          subtitle="Gold, property, crypto — what you own beyond shares, funds and cash"
          actionSlot={<AddAsset />}
        />
        <EmptyState
          Icon={Gem}
          title="Nothing recorded yet"
          body="Add the gold in the locker, the plot in the file, the car in the driveway. These count toward your net worth, and the ones you mark zakatable feed the Zakat calculator."
          action={<AddAsset />}
        />
      </div>
    );
  }

  return (
    <div className="flex-1 px-5 py-6 sm:px-6">
      <PageHeader
        title="Other Assets"
        subtitle="Gold, property, crypto — what you own beyond shares, funds and cash"
        search="Search assets"
        actionSlot={<AddAsset />}
      />

      <StatRow
        stats={[
          { k: "Total value", v: paisaFull(total) },
          { k: "What it cost", v: cost > 0 ? paisaFull(cost) : "—", tone: "muted" },
          {
            k: "Change",
            v: cost > 0 ? paisaFull(gain) : "—",
            tone: cost > 0 ? (gain >= 0 ? "gain" : "loss") : "muted",
          },
          { k: "Counted for Zakat", v: paisaFull(zakatable), tone: "muted" },
        ]}
      />

      {stale > 0 && (
        <p
          className="mb-5 rounded-[12px] border px-4 py-3 text-[12.5px]"
          style={{
            borderColor: "var(--border-subtle)",
            backgroundColor: "var(--surface-1)",
            color: "var(--text-muted)",
          }}
        >
          {stale} {stale === 1 ? "asset has" : "assets have"} not been revalued in over six
          months. Gold in particular moves — an out-of-date figure quietly makes your
          net worth wrong.
        </p>
      )}

      {q && shown.length === 0 && <NoMatches query={q} noun="assets" />}

      <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
        {shown.map((a) => {
          const change =
            a.cost_paisa && a.cost_paisa > 0
              ? ((a.value_paisa - a.cost_paisa) / a.cost_paisa) * 100
              : null;

          return (
            <section key={a.id} className="card p-5">
              <div className="mb-4 flex items-start justify-between gap-3">
                <span
                  className="rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.1em]"
                  style={{
                    fontFamily: "var(--font-mono)",
                    borderColor: "var(--border-subtle)",
                    color: "var(--text-faint)",
                  }}
                >
                  {LABELS[a.kind] ?? a.kind}
                </span>

                <div className="flex flex-none items-center gap-1.5">
                  {a.zakatable && (
                    <span
                      className="rounded-full px-2 py-1 text-[10px] uppercase tracking-[0.1em]"
                      style={{
                        fontFamily: "var(--font-mono)",
                        backgroundColor: "rgba(201,162,39,0.12)",
                        color: "var(--brass-text)",
                      }}
                    >
                      Zakat
                    </span>
                  )}
                  <RowActions
                    table="assets"
                    id={a.id}
                    name={a.name}
                    consequence="Your net worth and Zakat total will drop by its value."
                    editTitle="Edit asset"
                    action={updateAsset}
                  >
                    <AssetFields initial={a} />
                  </RowActions>
                </div>
              </div>

              <h3 className="text-[15px] font-semibold tracking-[-0.01em]">{a.name}</h3>
              {a.quantity && (
                <p className="mt-1 text-[11.5px]" style={{ color: "var(--text-faint)" }}>
                  {Number(a.quantity).toLocaleString("en-US", { maximumFractionDigits: 4 })}{" "}
                  {a.unit ?? ""}
                </p>
              )}

              <div className="mt-3 flex items-baseline text-[24px] font-semibold leading-none tracking-[-0.025em]">
                <span className="currency">PKR</span>
                <span data-numeric>{paisaFull(a.value_paisa)}</span>
              </div>

              {change !== null && (
                <div
                  className="mt-2 text-[12.5px]"
                  style={{ color: change >= 0 ? "var(--color-gain)" : "var(--color-loss)" }}
                  data-numeric
                >
                  {formatPct(change)} on what you paid
                </div>
              )}

              <div
                className="mt-4 border-t pt-3.5 text-[11.5px]"
                style={{ borderColor: "var(--border-subtle)", color: "var(--text-faint)" }}
              >
                Valued {a.as_of}
              </div>
            </section>
          );
        })}
      </div>

      <p className="mt-5 text-[11.5px]" style={{ color: "var(--text-faint)" }}>
        Totals shown in {notation === "subcontinental" ? "lakh and crore" : "international"}{" "}
        notation on the dashboard.
      </p>
    </div>
  );
}
