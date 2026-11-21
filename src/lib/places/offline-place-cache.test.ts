// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
  cachePlaceSearchHits,
  searchOfflineLocations,
} from "./offline-place-cache";

describe("offline-place-cache", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("finds bundled major Ugandan towns and districts offline", () => {
    const townHits = searchOfflineLocations("Bweyogerere");
    expect(townHits.some((h) => h.kind === "place" && h.name === "Bweyogerere")).toBe(true);

    const guluHits = searchOfflineLocations("Gulu");
    expect(guluHits.some((h) => h.kind === "district" && h.slug.includes("gulu"))).toBe(true);
  });

  it("persists searched parishes and resolves them offline later", () => {
    cachePlaceSearchHits([
      {
        kind: "place",
        key: "parish-kyaziiza",
        name: "Kyaziiza",
        label: "Lyantonde, Central",
        lat: -0.402,
        lon: 31.158,
        parentDistrictSlug: "lyantonde",
        region: "central",
        matchScore: 90,
      },
    ]);

    const hits = searchOfflineLocations("Kyaziiza");
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({
      kind: "place",
      name: "Kyaziiza",
      parentDistrictSlug: "lyantonde",
    });
  });
});
