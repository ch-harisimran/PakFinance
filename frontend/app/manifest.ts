import type { MetadataRoute } from "next";

/**
 * Installed-app identity. `start_url` opens the dashboard rather than the
 * marketing page — someone who has installed PakFinance has already been sold.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PakFinance — Your finances. One view.",
    short_name: "PakFinance",
    description:
      "Track your PSX holdings, mutual funds, bank accounts, loans, and goals in one place.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#0A0B0D",
    theme_color: "#0A0B0D",
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Maskable uses the bare mark: platforms crop to their own shape, and the
      // padded icon would get its facets clipped.
      { src: "/brand/mark-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
