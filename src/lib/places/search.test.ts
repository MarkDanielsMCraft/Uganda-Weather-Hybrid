import { describe, expect, it, vi } from "vitest";

const { searchOfficialLocalitiesMock } = vi.hoisted(() => ({
  searchOfficialLocalitiesMock: vi.fn(),
}));

vi.mock("@/lib/places/uganda-localities", () => ({
  searchOfficialLocalities: searchOfficialLocalitiesMock,
}));

const { searchLocations } = await import("./search");

describe("searchLocations resilience", () => {
  it("still returns district matches when place/locality search throws", async () => {
    // Regression test: locality search depends on two external services
    // (Nominatim, opendata.ssmusoke.dev) with no bounded timeout at the
    // time this bug was found — a failure there used to propagate all the
    // way up and take out the entire /locations/search response, even
    // though district matches don't depend on either service.
    searchOfficialLocalitiesMock.mockRejectedValue(new Error("Nominatim down"));

    const results = await searchLocations("Jinja");
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => r.kind === "district")).toBe(true);
  });

  it("merges district and place hits when everything succeeds", async () => {
    searchOfficialLocalitiesMock.mockResolvedValue([
      {
        kind: "place",
        name: "Kyaziiza",
        key: "village-1",
        label: "Bukomansimbi",
        lat: 0.1,
        lon: 31.5,
        parentDistrictSlug: "bukomansimbi",
        region: "central",
        placeType: "village",
        approximate: false,
        matchScore: 90,
      },
    ]);

    const results = await searchLocations("Kyaziiza");
    expect(results.some((r) => r.kind === "place")).toBe(true);
  });

  it("returns an empty array for a query under 2 characters without calling the place search", async () => {
    searchOfficialLocalitiesMock.mockClear();
    const results = await searchLocations("k");
    expect(results).toEqual([]);
    expect(searchOfficialLocalitiesMock).not.toHaveBeenCalled();
  });

  it("doesn't block on a slow place search once a confident district match already exists", async () => {
    // Regression test: searching an exact, well-known district name like
    // "Jinja" used to always wait for the full village/parish geocoding
    // chain too (up to its own several-second worst case) even though the
    // district match alone was already the obviously correct answer —
    // this was the single biggest contributor to "search is slow" for the
    // most common search case. A confident district hit should return
    // quickly even if the place search is still hanging.
    let releasePlaceSearch: (() => void) | undefined;
    searchOfficialLocalitiesMock.mockReturnValue(
      new Promise((resolve) => {
        releasePlaceSearch = () => resolve([]);
      }),
    );

    const start = Date.now();
    const results = await searchLocations("Jinja");
    const elapsedMs = Date.now() - start;

    expect(results.some((r) => r.kind === "district" && r.name.includes("Jinja"))).toBe(true);
    // Bounded by the search's own short budget, nowhere near the place
    // search's multi-second worst case (which is still "pending" here).
    expect(elapsedMs).toBeLessThan(2000);

    releasePlaceSearch?.();
  });
});
