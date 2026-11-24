import type { District } from "@/types/weather";
import { appBaseUrl } from "./metadata";

const UGANDA = {
  "@type": "Country" as const,
  name: "Uganda",
};

/** Schema.org graph for a single district page: the page itself, plus the
    Place it is about with real coordinates.

    Search engines use the Place/GeoCoordinates pair to understand that a page
    covers one specific location rather than the country generally, which is
    what makes a district page eligible for place qualified results such as
    "weather in Gulu". Without it every district page looks like the same
    national page to a crawler. */
export function districtStructuredData(
  district: District,
  locale: "en" | "lg" = "en",
) {
  const base = appBaseUrl();
  const isLuganda = locale === "lg";
  const url = isLuganda
    ? `${base}/lg/district/${district.slug}`
    : `${base}/district/${district.slug}`;
  const pageName = isLuganda
    ? `Embeera y'obudde e ${district.name}`
    : `${district.name} Weather`;
  const pageDescription = isLuganda
    ? `Embeera y'obudde eya leero, essaawa ku ssaawa, n'okulabula e ${district.name}, Uganda.`
    : `Live weather, hourly forecast, and alerts for ${district.name}, Uganda.`;

  const regionLabel = `${district.region.charAt(0).toUpperCase()}${district.region.slice(1)} Region`;

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${url}#webpage`,
        url,
        name: pageName,
        description: pageDescription,
        isPartOf: { "@id": `${base}/#website` },
        about: { "@id": `${url}#place` },
        breadcrumb: { "@id": `${url}#breadcrumb` },
        inLanguage: isLuganda ? "lg-UG" : "en-UG",
      },
      {
        "@type": "Place",
        "@id": `${url}#place`,
        name: district.name,
        url,
        geo: {
          "@type": "GeoCoordinates",
          latitude: district.coordinates.lat,
          longitude: district.coordinates.lon,
        },
        address: {
          "@type": "PostalAddress",
          addressLocality: district.name,
          addressRegion: regionLabel,
          addressCountry: "UG",
        },
        containedInPlace: UGANDA,
        hasMap: `${base}/map?district=${district.slug}`,
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${url}#breadcrumb`,
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: isLuganda ? "Olupapula olusooka" : "Home",
            item: isLuganda ? `${base}/lg` : base,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: regionLabel,
            item: `${base}/search?region=${district.region}`,
          },
          {
            "@type": "ListItem",
            position: 3,
            name: pageName,
            item: url,
          },
        ],
      },
    ],
  };
}

/** Schema.org graph for lake and fishing safety pages: connects the page,
    the water body, coordinates, and navigation breadcrumbs. */
export function lakeStructuredData({
  name,
  path,
  description,
  coordinates,
  locale = "en",
  pageTitle,
}: {
  name: string;
  path: string;
  description: string;
  coordinates: { lat: number; lon: number };
  locale?: "en" | "lg";
  pageTitle?: string;
}) {
  const base = appBaseUrl();
  const isLuganda = locale === "lg";
  const url = `${base}${path}`;
  const resolvedTitle = pageTitle ?? `${name} Fishing Safety`;

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${url}#webpage`,
        url,
        name: resolvedTitle,
        description,
        isPartOf: { "@id": `${base}/#website` },
        about: { "@id": `${url}#place` },
        breadcrumb: { "@id": `${url}#breadcrumb` },
        inLanguage: isLuganda ? "lg-UG" : "en-UG",
      },
      {
        "@type": "BodyOfWater",
        "@id": `${url}#place`,
        name,
        url,
        geo: {
          "@type": "GeoCoordinates",
          latitude: coordinates.lat,
          longitude: coordinates.lon,
        },
        containedInPlace: UGANDA,
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${url}#breadcrumb`,
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: isLuganda ? "Olupapula olusooka" : "Home",
            item: isLuganda ? `${base}/lg` : base,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: resolvedTitle,
            item: url,
          },
        ],
      },
    ],
  };
}

/** Geo meta tags for a district page. Several regional search engines
    and map/directory crawlers still read them, and they cost nothing to emit. */
export function districtGeoMeta(district: District): Record<string, string> {
  return {
    "geo.region": "UG",
    "geo.placename": district.name,
    "geo.position": `${district.coordinates.lat};${district.coordinates.lon}`,
    ICBM: `${district.coordinates.lat}, ${district.coordinates.lon}`,
  };
}
