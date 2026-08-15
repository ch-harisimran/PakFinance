import type { ReactNode } from "react";
import { GroundLayer } from "@/components/layout/GroundLayer";
import { Nav } from "@/components/layout/Nav";
import { SmoothScroll } from "@/components/providers/SmoothScroll";

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SmoothScroll />
      <GroundLayer />
      <Nav />
      <main className="content">{children}</main>
    </>
  );
}
