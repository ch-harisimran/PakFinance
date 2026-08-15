import { ImageResponse } from "next/og";

/**
 * Share card. The one raster asset in the project, and even this is generated
 * from code — so it can never drift from the design tokens the way a hand-made
 * export would.
 */
export const alt = "PakFinance — Your finances. One view.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0A0B0D",
          padding: "88px 96px",
        }}
      >
        {/* Brass bloom, matching the hero */}
        <div
          style={{
            position: "absolute",
            top: -220,
            right: -160,
            width: 820,
            height: 820,
            borderRadius: 999,
            background:
              "radial-gradient(circle, rgba(201,162,39,0.20) 0%, rgba(201,162,39,0.05) 45%, rgba(10,11,13,0) 70%)",
            display: "flex",
          }}
        />

        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          <svg width="64" height="64" viewBox="0 0 100 100">
            <polygon points="50,8 14,44 50,44" fill="#E6C767" />
            <polygon points="50,8 86,44 50,44" fill="#C9A227" />
            <polygon points="14,44 50,92 50,44" fill="#C9A227" />
            <polygon points="86,44 50,92 50,44" fill="#8E7118" />
          </svg>
          <div style={{ fontSize: 44, color: "#EAE7E0", letterSpacing: -1 }}>PakFinance</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 86,
              lineHeight: 1.04,
              letterSpacing: -3,
              color: "#EAE7E0",
              maxWidth: 900,
              display: "flex",
            }}
          >
            Your entire financial life. One intelligent view.
          </div>
          <div style={{ marginTop: 34, fontSize: 30, color: "#93908A", display: "flex" }}>
            PSX holdings · Mutual funds · Loans · Goals
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            fontSize: 24,
            color: "#65625C",
            borderTop: "1px solid rgba(234,231,224,0.10)",
            paddingTop: 26,
          }}
        >
          <div style={{ width: 8, height: 8, borderRadius: 999, background: "#3FBF7F", display: "flex" }} />
          Built for Pakistan
        </div>
      </div>
    ),
    { ...size },
  );
}
