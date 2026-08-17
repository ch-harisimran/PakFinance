"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { NAV_GROUPS, isActiveRoute } from "@/lib/nav";
import { displayName, initialsOf, type Profile } from "@/lib/profile";

/**
 * Navigation below `lg`, where the sidebar is hidden.
 *
 * The sidebar is `hidden lg:flex`, so on a phone there was NO way to reach any
 * screen but the one you landed on — the app had eleven pages and one of them
 * was reachable. This is that missing navigation.
 *
 * A drawer rather than a bottom tab bar: eleven destinations in five groups do
 * not fit five tabs, and flattening them would lose the grouping that makes the
 * list readable. The trigger lives in the top bar, which is already sticky.
 *
 * Rendered `lg:hidden` throughout, so nothing here exists on a laptop.
 */
export function MobileNav({ profile }: { profile: Profile | null }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // A drawer is a modal surface: Escape closes it, and the page behind must not
  // scroll under it.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);

  const name = profile ? displayName(profile) : "Your account";
  const initials = profile ? initialsOf(profile) : "?";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-expanded={open}
        className="grid h-9 w-9 flex-none place-items-center rounded-[10px] transition-colors duration-200 hover:bg-[var(--surface-2)] lg:hidden"
        style={{ color: "var(--text-secondary)" }}
      >
        <Menu size={18} strokeWidth={1.8} />
      </button>

      {/*
        PORTALLED TO <body>, and that is load-bearing.

        `position: fixed` is resolved against the nearest ancestor carrying a
        transform, filter, backdrop-filter or perspective — not the viewport.
        This trigger lives in the top bar, which has `backdrop-blur-xl`, so a
        `fixed inset-0` overlay rendered here was confined to the HEADER's box:
        a drawer about eighty pixels tall with the page showing beneath it.

        Rendering into <body> escapes that containing block, so the overlay
        covers the viewport as intended.
      */}
      {/* No `mounted` guard needed: `open` starts false and can only be set by a
        click, which is necessarily client-side, so `document.body` exists by
        the time this renders. */}
      {open && createPortal(
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 h-full w-full"
            style={{ backgroundColor: "rgba(10,11,13,0.72)", backdropFilter: "blur(6px)" }}
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            // z-10 and an explicit opaque colour: the backdrop beside it carries
            // a backdrop-filter, which establishes its own stacking context, and
            // the panel was reading through as translucent.
            className="absolute inset-y-0 left-0 z-10 flex w-[min(300px,84vw)] flex-col border-r"
            style={{
              backgroundColor: "#0A0B0D",
              borderColor: "var(--border-subtle)",
              boxShadow: "0 0 60px rgba(0,0,0,0.6)",
            }}
          >
            <div
              className="flex flex-none items-center justify-between border-b px-4 py-4"
              style={{ borderColor: "var(--border-subtle)" }}
            >
              <Logo href="/dashboard" text={18} />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="grid h-9 w-9 place-items-center rounded-[10px] transition-colors duration-200 hover:bg-[var(--surface-2)]"
                style={{ color: "var(--text-muted)" }}
              >
                <X size={18} strokeWidth={1.8} />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto px-3 py-4">
              {NAV_GROUPS.map((g) => (
                <div key={g.label} className="mb-5">
                  <div
                    className="mb-2 px-3 text-[9.5px] uppercase tracking-[0.16em]"
                    style={{ fontFamily: "var(--font-mono)", color: "var(--text-faint)" }}
                  >
                    {g.label}
                  </div>
                  <div className="flex flex-col gap-0.5">
                    {g.items.map((item) => {
                      const active = isActiveRoute(item.href, pathname);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          aria-current={active ? "page" : undefined}
                          // Closed on tap rather than in an effect watching the
                          // pathname: setting state synchronously in an effect
                          // cascades a render, and the click already knows.
                          onClick={() => setOpen(false)}
                          // min-h-[44px]: a comfortable finger target, above the
                          // 24px WCAG floor. This is a touch-only surface, so it
                          // is sized for touch rather than for a cursor.
                          className="relative flex min-h-[44px] items-center gap-3 rounded-[10px] px-3 text-[14px] transition-colors duration-200 active:bg-[var(--surface-2)]"
                          style={{
                            backgroundColor: active ? "var(--surface-2)" : "transparent",
                            color: active ? "var(--text-primary)" : "var(--text-muted)",
                          }}
                        >
                          {active && (
                            <span
                              aria-hidden="true"
                              className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-full"
                              style={{ backgroundColor: "var(--color-brass)" }}
                            />
                          )}
                          <item.Icon size={17} strokeWidth={1.7} className="flex-none" />
                          <span className="truncate">{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>

            <Link
              href="/dashboard/settings"
              onClick={() => setOpen(false)}
              className="flex flex-none items-center gap-3 border-t px-4 py-4"
              style={{ borderColor: "var(--border-subtle)" }}
            >
              {profile?.avatarUrl ? (
                <Image
                  src={profile.avatarUrl}
                  alt=""
                  width={34}
                  height={34}
                  className="h-[34px] w-[34px] flex-none rounded-full object-cover"
                  unoptimized
                />
              ) : (
                <span
                  className="grid h-[34px] w-[34px] flex-none place-items-center rounded-full text-[12px] font-semibold"
                  style={{ backgroundColor: "var(--surface-3)" }}
                >
                  {initials}
                </span>
              )}
              <span className="min-w-0">
                <span className="block truncate text-[13.5px]">{name}</span>
                <span
                  className="block truncate text-[11.5px]"
                  style={{ color: "var(--text-faint)" }}
                >
                  {profile?.email}
                </span>
              </span>
            </Link>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
