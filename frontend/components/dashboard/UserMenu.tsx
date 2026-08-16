"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ChevronDown, User, Settings, LogOut } from "lucide-react";
import { signOut } from "@/app/(auth)/actions";
import { displayName, initialsOf, type Profile } from "@/lib/profile";

/**
 * Account menu. Takes the slot the global Add button used to occupy — Add is
 * meaningless without a context, so it now lives on the screens that own a
 * record type (holdings, funds, accounts, loans, goals).
 *
 * The profile is passed down from the layout rather than fetched here: this is a
 * client component for the dropdown behaviour alone, and a client component has
 * no business holding a session.
 */
export function UserMenu({ profile }: { profile: Profile | null }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const name = profile ? displayName(profile) : "Your account";
  const initials = profile ? initialsOf(profile) : "?";

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2.5 rounded-[10px] border py-1.5 pl-1.5 pr-2.5 transition-colors duration-200 hover:bg-[var(--surface-2)]"
        style={{
          borderColor: open ? "var(--border-strong)" : "var(--border-subtle)",
          backgroundColor: open ? "var(--surface-2)" : "transparent",
        }}
      >
        {profile?.avatarUrl ? (
          <Image
            src={profile.avatarUrl}
            alt=""
            width={28}
            height={28}
            className="h-7 w-7 flex-none rounded-full object-cover"
            unoptimized
          />
        ) : (
          <span
            className="grid h-7 w-7 flex-none place-items-center rounded-full text-[11.5px] font-semibold"
            style={{ backgroundColor: "var(--surface-3)" }}
          >
            {initials}
          </span>
        )}
        <span className="hidden max-w-[160px] truncate text-[13px] font-medium sm:block">
          {name}
        </span>
        <ChevronDown
          size={14}
          strokeWidth={1.8}
          className="transition-transform duration-200"
          style={{
            color: "var(--text-faint)",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
          }}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+8px)] z-50 w-[240px] overflow-hidden rounded-[14px] border"
          style={{
            borderColor: "var(--border-subtle)",
            backgroundColor: "#111318",
            boxShadow: "var(--highlight-top), 0 24px 64px -20px rgba(0,0,0,0.8)",
          }}
        >
          <div className="border-b px-4 py-3.5" style={{ borderColor: "var(--border-subtle)" }}>
            <div className="truncate text-[13.5px] font-medium">{name}</div>
            <div className="mt-0.5 truncate text-[11.5px]" style={{ color: "var(--text-faint)" }}>
              {profile?.email ?? "Not signed in"}
            </div>
          </div>

          <div className="p-1.5">
            <MenuLink href="/dashboard/settings" Icon={User} label="Profile" />
            <MenuLink href="/dashboard/settings" Icon={Settings} label="Settings" />
          </div>

          <div className="border-t p-1.5" style={{ borderColor: "var(--border-subtle)" }}>
            {/* A form, not a click handler: signOut is a server action, so the
                session cookie is cleared server-side rather than the client
                merely navigating away from a session that still exists. */}
            <form action={signOut}>
              <button
                type="submit"
                role="menuitem"
                className="flex w-full items-center gap-3 rounded-[9px] px-3 py-2.5 text-left text-[13px] transition-colors duration-200 hover:bg-[var(--surface-2)]"
                style={{ color: "var(--color-loss)" }}
              >
                <LogOut size={15} strokeWidth={1.7} />
                Log out
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuLink({
  href,
  Icon,
  label,
}: {
  href: string;
  Icon: typeof User;
  label: string;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      className="flex items-center gap-3 rounded-[9px] px-3 py-2.5 text-[13px] transition-colors duration-200 hover:bg-[var(--surface-2)]"
      style={{ color: "var(--text-secondary)" }}
    >
      <Icon size={15} strokeWidth={1.7} />
      {label}
    </Link>
  );
}
