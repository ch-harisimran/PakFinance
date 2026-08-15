import type { Metadata, Viewport } from "next";
import "./globals.css";
import { fontVariables } from "./fonts";
import { NoiseOverlay } from "@/components/layout/NoiseOverlay";
import { Cursor } from "@/components/motion/Cursor";

export const metadata: Metadata = {
  title: "PakFinance — Your finances. One view.",
  description:
    "Track your PSX holdings, mutual funds, bank accounts, loans, and goals in one place. PakFinance is a personal finance tracking tool for Pakistan.",
  applicationName: "PakFinance",
  // app/icon.png, app/apple-icon.png and app/opengraph-image.tsx are picked up
  // by convention — declaring them here as well would only risk them drifting.
};

export const viewport: Viewport = {
  // Paints the browser chrome to match the ink ground on mobile, so the app
  // does not sit in a white frame.
  themeColor: "#0A0B0D",
  colorScheme: "dark",
};

/**
 * Root layout holds only what every surface shares: fonts, grain, cursor.
 *
 * The landing page's scroll machinery (GroundLayer, Lenis, the marketing nav)
 * lives in (marketing) — auth screens and the dashboard are static, single-view
 * surfaces and must not pay for it.
 */
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${fontVariables} antialiased`}>
      <body>
        <NoiseOverlay />
        <Cursor />
        {children}
      </body>
    </html>
  );
}
