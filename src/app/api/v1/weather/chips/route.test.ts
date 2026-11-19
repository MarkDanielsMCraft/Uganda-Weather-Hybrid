import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeWeatherBundle } from "@/lib/test-fixtures/weather-bundle";
import { getMajorLocations } from "@/lib/districts";

const { getWeatherBundleForDistrictMock } = vi.hoisted(() => ({
  getWeatherBundleForDistrictMock: vi.fn(),
}));

vi.mock("@/lib/weather/provider", () => ({
  getWeatherBundleForDistrict: getWeatherBundleForDistrictMock,
}));

describe("GET /api/v1/weather/chips", () => {
  // The in-memory cache is a module-level singleton, so a fresh module
  // instance is needed per test — otherwise the second test would just
  // read back the first test's cached result instead of exercising its
  // own mock.
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns one batched weather entry per major location, not one request each", async () => {
    getWeatherBundleForDistrictMock.mockResolvedValue(
      makeWeatherBundle({ temperature: { celsius: 24, feelsLike: 24 } }),
    );
    const { GET } = await import("./route");

    const res = await GET(new Request("http://localhost/api/v1/weather/chips"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.chips.length).toBe(getMajorLocations().length);
    expect(body.data.chips[0]).toMatchObject({ tempC: 24 });
  });

  it("omits chips whose weather lookup fails, without failing the whole request", async () => {
    getWeatherBundleForDistrictMock.mockRejectedValue(new Error("provider down"));
    const { GET } = await import("./route");

    const res = await GET(new Request("http://localhost/api/v1/weather/chips"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.chips).toEqual([]);
  });
});
