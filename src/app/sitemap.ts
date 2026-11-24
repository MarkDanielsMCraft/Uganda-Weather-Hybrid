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

/** Fixed at build time rather than evaluated per request. `new Date()` here
    told every crawl that all 168 URLs had just changed, which is not true and
    which search engines learn to distrust and then ignore. A build stamp is
    the honest answer: these pages change when the site is redeployed, and the
    live weather on them changes continuously, which is what `changeFrequency`
    is for. */
const BUILT_AT = new Date();

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = appBaseUrl();
  const lastModified = BUILT_AT;

  const staticEntries = STATIC_ROUTES.map((path) => ({
    url: `${baseUrl}${path}`,
    lastModified,
    changeFrequency: path === "" ? ("hourly" as const) : ("daily" as const),
    priority: path === "" ? 1 : 0.7,
  }));

  const districtEntries = getAllDistricts().map((district) => ({
    url: `${baseUrl}/district/${district.slug}`,
    lastModified,
    changeFrequency: "hourly" as const,
    priority: district.slug === "kampala" ? 0.95 : 0.8,
  }));

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
    {
      url: `${baseUrl}/lg`,
      lastModified,
      changeFrequency: "hourly",
      priority: 0.9,
    },
    ...LUGANDA_SECTION_ROUTES.map((path) => ({
      url: `${baseUrl}${path}`,
      lastModified,
      changeFrequency: "daily" as const,
      priority: 0.65,
    })),
    ...getAllDistricts().map((district) => ({
      url: `${baseUrl}/lg/district/${district.slug}`,
      lastModified,
      changeFrequency: "hourly" as const,
      priority: district.slug === "kampala" ? 0.9 : 0.75,
    })),
  ];

  return [...staticEntries, ...districtEntries, ...lugandaEntries];
}
