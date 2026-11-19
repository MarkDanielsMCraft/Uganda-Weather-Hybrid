import { describe, expect, it, vi } from "vitest";
import { makeDistrict, makeWeatherBundle } from "@/lib/test-fixtures/weather-bundle";

const { getWeatherBundleForDistrictMock } = vi.hoisted(() => ({
  getWeatherBundleForDistrictMock: vi.fn(),
}));

vi.mock("@/lib/weather/provider", () => ({
  getWeatherBundleForDistrict: getWeatherBundleForDistrictMock,
}));

const { GET } = await import("./route");

const tenDays = Array.from({ length: 10 }, (_, i) => ({
  day: `Day ${i}`,
  high: 28,
  low: 18,
  icon: "",
  isToday: i === 0,
}));

describe("GET /api/v1/weather/forecast", () => {
  it("defaults to a 10-day forecast and slices dailyForecast accordingly", async () => {
    getWeatherBundleForDistrictMock.mockResolvedValue(
      makeWeatherBundle({
        district: makeDistrict({ slug: "gulu", name: "Gulu" }),
        dailyForecast: tenDays,
      }),
    );

    const res = await GET(new Request("http://localhost/api/v1/weather/forecast?district=gulu"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.days).toBe(10);
    expect(body.data.dailyForecast).toHaveLength(10);
  });

  it("honors a custom days parameter", async () => {
    getWeatherBundleForDistrictMock.mockResolvedValue(
      makeWeatherBundle({
        district: makeDistrict({ slug: "mbale", name: "Mbale" }),
        dailyForecast: tenDays,
      }),
    );

    const res = await GET(new Request("http://localhost/api/v1/weather/forecast?district=mbale&days=3"));
    const body = await res.json();
    expect(body.data.days).toBe(3);
    expect(body.data.dailyForecast).toHaveLength(3);
  });

  it("rejects a days value outside 1-14", async () => {
    const res = await GET(new Request("http://localhost/api/v1/weather/forecast?district=kabale&days=20"));
    expect(res.status).toBe(400);
  });

  it("returns 404 for an unknown district", async () => {
    const res = await GET(new Request("http://localhost/api/v1/weather/forecast?district=nowhere"));
    expect(res.status).toBe(404);
  });
});
