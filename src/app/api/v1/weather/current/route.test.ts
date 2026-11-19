import { describe, expect, it, vi } from "vitest";
import { makeDistrict, makeWeatherBundle } from "@/lib/test-fixtures/weather-bundle";

const { getWeatherBundleForDistrictMock } = vi.hoisted(() => ({
  getWeatherBundleForDistrictMock: vi.fn(),
}));

vi.mock("@/lib/weather/provider", () => ({
  getWeatherBundleForDistrict: getWeatherBundleForDistrictMock,
}));

const { GET } = await import("./route");

describe("GET /api/v1/weather/current", () => {
  it("returns the weather bundle for a valid district", async () => {
    getWeatherBundleForDistrictMock.mockResolvedValue(
      makeWeatherBundle({ district: makeDistrict({ slug: "jinja", name: "Jinja" }) }),
    );

    const res = await GET(new Request("http://localhost/api/v1/weather/current?district=jinja"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.district.slug).toBe("jinja");
    expect(body.data.temperature.celsius).toBe(24);
    expect(res.headers.get("X-Cache")).toBe("HIT");
  });

  it("rejects a missing district with 400", async () => {
    const res = await GET(new Request("http://localhost/api/v1/weather/current"));
    expect(res.status).toBe(400);
  });

  it("returns 404 for a well-formed but unknown district", async () => {
    const res = await GET(new Request("http://localhost/api/v1/weather/current?district=nowhere"));
    expect(res.status).toBe(404);
  });

  it("resolves a place by lat/lon instead of a district slug", async () => {
    getWeatherBundleForDistrictMock.mockResolvedValue(
      makeWeatherBundle({ district: makeDistrict({ slug: "mukono", name: "Mukono (near Nakisunga)" }) }),
    );

    const res = await GET(
      new Request(
        "http://localhost/api/v1/weather/current?place=nakisunga&name=Nakisunga&lat=0.35&lon=32.75",
      ),
    );
    expect(res.status).toBe(200);
  });

  it("returns 503 when the weather provider throws (all fallbacks exhausted)", async () => {
    getWeatherBundleForDistrictMock.mockRejectedValue(new Error("everything is down"));
    const res = await GET(new Request("http://localhost/api/v1/weather/current?district=arua"));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error.code).toBe("SERVICE_UNAVAILABLE");
  });
});
