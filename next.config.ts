import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      /**
       * Raised from the 1 MB default for the admin console's MUFAP upload.
       *
       * The saved report is ~1.3 MB of HTML, so the default rejected it before
       * the action ran at all — the failure surfaced as "Body exceeded 1 MB
       * limit" from the page, not as an error the console could explain.
       *
       * 4 MB, not more: Vercel caps a serverless request body at 4.5 MB, so a
       * larger ceiling here would only move the failure to the platform edge
       * where nothing of ours can report it. `importNavAction` checks the same
       * 4 MB itself, so an oversized file gets a sentence rather than a stack
       * trace.
       */
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
