import type { Metadata } from "next";
import type { ReactNode } from "react";

// The page is a client component; see app/(auth)/layout.tsx.
export const metadata: Metadata = { title: "Sign in" };

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
