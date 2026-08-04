import type { MetadataRoute } from "next";

// Valid robots.txt (Lighthouse flagged the absence/invalid one). Public site is crawlable; keep the
// API and the auth/admin/account surfaces out of the index — they're either non-content or private.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/admin", "/settings", "/welcome"],
    },
  };
}
