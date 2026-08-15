"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/Button";

const LINKS = [
  { label: "Features", href: "#features" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Security", href: "#security" },
  { label: "FAQ", href: "#faq" },
];

export function Nav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      data-nav
      className="fixed inset-x-0 top-0 z-50 transition-[background-color,backdrop-filter,border-color] duration-300"
      style={{
        backgroundColor: scrolled ? "rgba(10,11,13,0.72)" : "transparent",
        backdropFilter: scrolled ? "blur(20px)" : "none",
        WebkitBackdropFilter: scrolled ? "blur(20px)" : "none",
        borderBottom: `1px solid ${scrolled ? "var(--border-subtle)" : "transparent"}`,
      }}
    >
      <nav className="mx-auto flex h-[72px] max-w-[1360px] items-center justify-between px-5 sm:px-8 lg:px-12">
        <Logo href="/" />

        <div className="hidden items-center gap-8 lg:flex">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-[14px] transition-colors duration-200"
              style={{ color: "var(--text-muted)" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
            >
              {l.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-4">
          <Link
            href="/login"
            className="hidden text-[14px] transition-colors duration-200 sm:block"
            style={{ color: "var(--text-muted)" }}
          >
            Log in
          </Link>
          <Button href="/signup" variant="primary" magnetic arrow>
            Get Started
          </Button>
        </div>
      </nav>
    </header>
  );
}
