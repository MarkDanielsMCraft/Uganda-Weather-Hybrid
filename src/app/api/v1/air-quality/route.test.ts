import { describe, expect, it, vi } from "vitest";
import { makeDistrict, makeWeatherBundle } from "@/lib/test-fixtures/weather-bundle";

const { getWeatherBundleForDistrictMock } = vi.hoisted(() => ({
  getWeatherBundleForDistrictMock: vi.fn(),
}));

vi.mock("@/lib/weather/provider", () => ({
  getWeatherBundleForDistrict: getWeatherBundleForDistrictMock,
}));

const { GET } = await import("./route");

describe("GET /api/v1/air-quality", () => {
  it("returns the district's air quality and UV index", async () => {
    getWeatherBundleForDistrictMock.mockResolvedValue(
      makeWeatherBundle({
        district: makeDistrict({ slug: "mbarara", name: "Mbarara" }),
        airQuality: { aqi: 65, category: "Moderate", advice: "Fine for most people.", pm25: 20 },
        uvIndex: 8,
      }),
    );

    const res = await GET(new Request("http://localhost/api/v1/air-quality?district=mbarara"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.airQuality).toMatchObject({ aqi: 65, category: "Moderate" });
    expect(body.data.uvIndex).toBe(8);
  });

  it("returns 404 for an unknown district", async () => {
    const res = await GET(new Request("http://localhost/api/v1/air-quality?district=nowhere"));
    expect(res.status).toBe(404);
  });

  it("returns 503 when the weather provider fails", async () => {
    getWeatherBundleForDistrictMock.mockRejectedValue(new Error("down"));
    const res = await GET(new Request("http://localhost/api/v1/air-quality?district=soroti"));
    expect(res.status).toBe(503);
  });
});
