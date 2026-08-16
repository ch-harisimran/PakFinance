import type { MetadataRoute } from "next";

/**
 * The landing page and the legal pages are the only public surfaces. Everything
 * behind sign-in is disallowed here as well as `noindex`-tagged in its layout —
 * the tag is what actually keeps a page out of an index, but a crawler that
 * never fetches the URL cannot leak it through a referrer or a cache either.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard/", "/login", "/signup", "/verify", "/reset-password", "/forgot-password", "/api/"],
    },
  };
}
