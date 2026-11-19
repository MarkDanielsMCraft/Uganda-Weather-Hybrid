import { describe, expect, it, vi } from "vitest";
import { makeWeatherBundle } from "@/lib/test-fixtures/weather-bundle";

const { getWeatherBundleForDistrictMock } = vi.hoisted(() => ({
  getWeatherBundleForDistrictMock: vi.fn(),
}));

vi.mock("@/lib/weather/provider", () => ({
  getWeatherBundleForDistrict: getWeatherBundleForDistrictMock,
}));

const { GET } = await import("./route");

describe("GET /api/v1/weather/points", () => {
  it("returns weather for every point in the requested set", async () => {
    getWeatherBundleForDistrictMock.mockResolvedValue(
      makeWeatherBundle({ temperature: { celsius: 22, feelsLike: 22 } }),
    );

    const res = await GET(new Request("http://localhost/api/v1/weather/points?set=parks"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.points.length).toBeGreaterThan(0);
    expect(body.data.points[0]).toMatchObject({ tempC: 22 });
  });

  it("returns 400 for an unknown set", async () => {
    const res = await GET(new Request("http://localhost/api/v1/weather/points?set=nonsense"));
    expect(res.status).toBe(400);
  });

  it("omits points whose weather lookup fails, without failing the whole request", async () => {
    getWeatherBundleForDistrictMock.mockRejectedValue(new Error("provider down"));

    const res = await GET(new Request("http://localhost/api/v1/weather/points?set=mountains"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.points).toEqual([]);
  });
});
