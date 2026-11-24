import type { MetadataRoute } from "next";
import { getAllDistricts } from "@/lib/districts";
import { appBaseUrl } from "@/lib/seo/metadata";

const STATIC_ROUTES = [
  "",
  "/search",
  "/forecast",
  "/alerts",
  "/map",
  "/air-quality",
  "/agriculture",
  "/lake-victoria",
  "/lake-kyoga",
  "/lake-albert",
  "/lake-edward",
  "/disclaimer",
  "/privacy",
  "/terms",
  "/cookies",
  "/attribution",
  "/lite",
];

/** Only page addresses are listed. Google ignores priority and changefreq,
    and uses lastmod only when it is the true date the main content changed.
    The forecast pages change every hour and the other pages have no tracked
    change date, so leaving lastmod out is the honest choice. */
export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = appBaseUrl();

  const staticEntries = STATIC_ROUTES.map((path) => ({ url: `${baseUrl}${path}` }));

  const districtEntries = getAllDistricts().map((district) => ({ url: `${baseUrl}/district/${district.slug}` }));

  const LUGANDA_SECTION_ROUTES = [
    "/lg/search",
    "/lg/forecast",
    "/lg/alerts",
    "/lg/map",
    "/lg/air-quality",
    "/lg/agriculture",
    "/lg/lake-victoria",
    "/lg/lake-kyoga",
    "/lg/lake-albert",
    "/lg/lake-edward",
  ];

  const lugandaEntries: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/lg` },
    ...LUGANDA_SECTION_ROUTES.map((path) => ({ url: `${baseUrl}${path}` })),
    ...getAllDistricts().map((district) => ({ url: `${baseUrl}/lg/district/${district.slug}` })),
  ];

  return [...staticEntries, ...districtEntries, ...lugandaEntries];
}
