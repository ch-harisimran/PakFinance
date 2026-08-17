"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";

/**
 * Per-screen search.
 *
 * State lives in the URL (`?q=`), not in a component, for three reasons: the
 * screens are server components and can filter their own rows before rendering
 * them; a filtered view can be linked to or reloaded; and the back button
 * behaves the way people expect.
 *
 * Typing is debounced and pushed with `replace`, so a search does not leave one
 * history entry per keystroke.
 */
export function SearchBox({ placeholder }: { placeholder: string }) {
  const params = useSearchParams();
  const initial = params.get("q") ?? "";

  /**
   * Keyed on the URL's value so that an external change — the back button, a
   * cleared filter, a shared link — remounts the input with fresh state.
   *
   * The alternative, an effect that calls setState when the params change, is
   * a cascading render and fights the user mid-keystroke. Letting React discard
   * the old instance is both simpler and correct.
   */
  return <SearchInput key={initial} initial={initial} placeholder={placeholder} />;
}

function SearchInput({ initial, placeholder }: { initial: string; placeholder: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const [value, setValue] = useState(initial);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const current = params.get("q") ?? "";
    if (value === current) return;

    const timer = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (value.trim()) next.set("q", value.trim());
      else next.delete("q");

      startTransition(() => {
        router.replace(`${pathname}${next.toString() ? `?${next}` : ""}`, { scroll: false });
      });
    }, 220);

    return () => clearTimeout(timer);
  }, [value, params, pathname, router]);

  return (
    <div
      className="flex h-9 min-w-[220px] items-center gap-2.5 rounded-[10px] border px-3 focus-within:border-[var(--color-brass)]"
      style={{
        borderColor: "var(--border-subtle)",
        backgroundColor: "var(--surface-1)",
        opacity: pending ? 0.75 : 1,
      }}
    >
      <Search size={14} strokeWidth={1.8} style={{ color: "var(--text-faint)" }} />
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        // h-full, so the whole 36px box is the tap target rather than the 21px
        // of text inside it.
        className="h-full w-full bg-transparent text-[13px] outline-none placeholder:text-[var(--text-faint)] [&::-webkit-search-cancel-button]:appearance-none"
        style={{ color: "var(--text-primary)" }}
      />
      {value && (
        <button
          type="button"
          onClick={() => {
            setValue("");
            inputRef.current?.focus();
          }}
          aria-label="Clear search"
          className="grid h-5 w-5 flex-none place-items-center rounded-full transition-colors duration-150 hover:bg-[var(--surface-3)]"
          style={{ color: "var(--text-faint)" }}
        >
          <X size={12} strokeWidth={2} />
        </button>
      )}
    </div>
  );
}

/**
 * Shown in place of a list when a search matches nothing. Distinct from the
 * screen's own empty state: "you have no accounts" and "no accounts match
 * 'meezn'" call for different next actions.
 */
export function NoMatches({ query, noun }: { query: string; noun: string }) {
  return (
    <div className="px-5 py-12 text-center">
      <p className="text-[13.5px]" style={{ color: "var(--text-secondary)" }}>
        No {noun} match <span style={{ color: "var(--text-primary)" }}>&ldquo;{query}&rdquo;</span>
      </p>
      <p className="mt-1.5 text-[12.5px]" style={{ color: "var(--text-faint)" }}>
        Check the spelling, or clear the search to see everything.
      </p>
    </div>
  );
}
