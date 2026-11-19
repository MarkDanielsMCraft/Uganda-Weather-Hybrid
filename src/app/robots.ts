import type { MetadataRoute } from "next";
import { appBaseUrl } from "@/lib/seo/metadata";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/api/og"],
        // The JSON endpoints are the app's own data layer, not pages. They
        // carry no titles, no links and no readable prose, so anything that
        // crawls them spends budget on responses that can only ever be
        // dropped from the index. The pages that present that same data are
        // all reachable and all in the sitemap. OpenGraph images at /api/og
        // are allowed so preview cards render for shared links.
        disallow: ["/api/"],
      },
    ],
    sitemap: `${appBaseUrl()}/sitemap.xml`,
  };
}
