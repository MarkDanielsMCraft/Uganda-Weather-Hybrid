import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/places/nominatim-pacer", async (original) => {
  const real = await original<typeof import("@/lib/places/nominatim-pacer")>();
  return {
    ...real,
    waitForNominatimTurn: vi.fn(async () => {
      throw new real.MapServiceBusyError();
    }),
  };
});

import { geocodeOfficialLocality, reverseGeocodeUganda } from "@/lib/places/geocode";

describe("place lookups when the map service queue is full", () => {
  const fetchMock = vi.fn();

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("answers a location lookup with the nearest district and never calls the map service", async () => {
    vi.stubGlobal("fetch", fetchMock);
    const place = await reverseGeocodeUganda(0.3476, 32.5825);
    expect(place.approximate).toBe(true);
    expect(place.label).toMatch(/^Near /);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("gives a village the district point instead of waiting", async () => {
    vi.stubGlobal("fetch", fetchMock);
    const point = await geocodeOfficialLocality({
      cacheKey: "test-busy-village",
      name: "Kireka",
      parish: "Kireka",
      subcounty: "Kira",
      districtName: "Wakiso",
      districtSlug: "wakiso",
    });
    expect(point.approximate).toBe(true);
    expect(Number.isFinite(point.lat) && Number.isFinite(point.lon)).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
