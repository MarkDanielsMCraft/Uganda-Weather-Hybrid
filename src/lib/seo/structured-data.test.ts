import { describe, expect, it } from "vitest";
import { districtGeoMeta, districtStructuredData } from "./structured-data";
import type { District } from "@/types/weather";

type JsonLdNode = {
  "@type": string;
  "@id"?: string;
  name?: string;
  geo?: Record<string, unknown>;
  address?: Record<string, unknown>;
  containedInPlace?: Record<string, unknown>;
  about?: Record<string, unknown>;
  isPartOf?: { "@id": string };
};

const gulu: District = {
  id: "UG-GUL",
  name: "Gulu",
  slug: "gulu",
  region: "northern",
  coordinates: { lat: 2.7746, lon: 32.2989 },
  rainfallPattern: "unimodal",
  hazards: ["lightning"],
};

function graphOf(district: District): JsonLdNode[] {
  return districtStructuredData(district)["@graph"] as unknown as JsonLdNode[];
}

function nodeOfType(graph: JsonLdNode[], type: string): JsonLdNode {
  const found = graph.find((node) => node["@type"] === type);
  if (!found) throw new Error(`no ${type} node in graph`);
  return found;
}

describe("districtStructuredData", () => {
  it("describes the district as a Place with real coordinates", () => {
    const place = nodeOfType(graphOf(gulu), "Place");

    expect(place.name).toBe("Gulu");
    expect(place.geo).toMatchObject({
      "@type": "GeoCoordinates",
      latitude: 2.7746,
      longitude: 32.2989,
    });
    expect(place.address).toMatchObject({
      addressCountry: "UG",
      addressRegion: "Northern Region",
    });
    expect(place.containedInPlace).toMatchObject({ name: "Uganda" });
  });

  it("links the page to the site and to the place it is about", () => {
    const graph = graphOf(gulu);
    const page = nodeOfType(graph, "WebPage");
    const place = nodeOfType(graph, "Place");

    expect(page.about).toEqual({ "@id": place["@id"] });
    expect(page.isPartOf?.["@id"]).toContain("#website");
  });

  it("includes map links and navigation breadcrumbs", () => {
    const graph = graphOf(gulu);
    const place = nodeOfType(graph, "Place") as JsonLdNode & { hasMap?: string };
    const breadcrumb = nodeOfType(graph, "BreadcrumbList") as JsonLdNode & {
      itemListElement?: Array<{ position: number; name: string; item: string }>;
    };

    expect(place.hasMap).toContain("/map?district=gulu");
    expect(breadcrumb.itemListElement).toHaveLength(3);
    expect(breadcrumb.itemListElement?.[0].name).toBe("Home");
    expect(breadcrumb.itemListElement?.[1].name).toBe("Northern Region");
    expect(breadcrumb.itemListElement?.[2].name).toBe("Gulu Weather");
  });
});

describe("districtGeoMeta", () => {
  it("emits geo tags for the district position", () => {
    expect(districtGeoMeta(gulu)).toMatchObject({
      "geo.region": "UG",
      "geo.placename": "Gulu",
      "geo.position": "2.7746;32.2989",
      ICBM: "2.7746, 32.2989",
    });
  });
});
