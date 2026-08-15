import { Meter } from "@/components/ui/Meter";
import { formatCompact } from "@/lib/money";

/**
 * Categorical breakdown: a stacked bar for share-of-whole, plus a legend where
 * every row carries its own proportional bar.
 *
 * Two encodings on purpose. The stacked bar answers "how is the whole divided";
 * the per-row bars answer "which is bigger" by LENGTH, so that comparison never
 * depends on telling two colours apart. Colour is reduced to a label that links
 * a row to its segment — which is all colour is good for.
 */
export function Breakdown({
  items,
  className = "",
}: {
  items: { key: string; value: number; pct: number; color: string }[];
  className?: string;
}) {
  const max = Math.max(...items.map((i) => i.pct));

  return (
    <div className={className}>
      <div className="flex h-2.5 gap-[2px] overflow-hidden rounded-full">
        {items.map((i) => (
          <span
            key={i.key}
            className="h-full first:rounded-l-full last:rounded-r-full"
            style={{ width: `${i.pct}%`, backgroundColor: i.color }}
            title={`${i.key} · ${i.pct.toFixed(1)}%`}
          />
        ))}
      </div>

      <ul className="mt-5 flex flex-col gap-4">
        {items.map((i) => (
          <li key={i.key}>
            <div className="mb-2 flex items-baseline gap-3">
              <span
                className="h-2.5 w-2.5 flex-none translate-y-[1px] rounded-[3px]"
                style={{ backgroundColor: i.color }}
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1 truncate text-[13px]">{i.key}</span>
              <span className="text-[12px]" style={{ color: "var(--text-faint)" }} data-numeric>
                {formatCompact(i.value)}
              </span>
              <span className="w-[46px] text-right text-[13px] font-semibold" data-numeric>
                {i.pct.toFixed(1)}%
              </span>
            </div>
            <Meter
              value={(i.pct / max) * 100}
              color={i.color}
              track="var(--surface-2)"
              height={4}
              className="ml-[22px]"
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
