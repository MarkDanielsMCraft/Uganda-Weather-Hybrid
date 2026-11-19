import { describe, expect, it, vi } from "vitest";
import { makeDistrict, makeWeatherBundle } from "@/lib/test-fixtures/weather-bundle";

const { getWeatherBundleForDistrictMock } = vi.hoisted(() => ({
  getWeatherBundleForDistrictMock: vi.fn(),
}));

vi.mock("@/lib/weather/provider", () => ({
  getWeatherBundleForDistrict: getWeatherBundleForDistrictMock,
}));

const { GET } = await import("./route");

describe("GET /api/v1/marine/lake-victoria", () => {
  it("defaults to the Kalangala (central) reference district with no params", async () => {
    getWeatherBundleForDistrictMock.mockResolvedValue(
      makeWeatherBundle({ district: makeDistrict({ slug: "kalangala", name: "Kalangala" }) }),
    );

    const res = await GET(new Request("http://localhost/api/v1/marine/lake-victoria"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.district.slug).toBe("kalangala");
    expect(body.data.fishingSafety).toBeTruthy();
  });

  it("resolves a requested lake shoreline district directly", async () => {
    getWeatherBundleForDistrictMock.mockResolvedValue(
      makeWeatherBundle({ district: makeDistrict({ slug: "jinja", name: "Jinja", region: "eastern" }) }),
    );

    const res = await GET(new Request("http://localhost/api/v1/marine/lake-victoria?shore=jinja"));
    const body = await res.json();
    expect(body.data.district.slug).toBe("jinja");
    expect(body.data.zone).toBe("eastern");
  });

  it("flags danger conditions during a thunderstorm", async () => {
    getWeatherBundleForDistrictMock.mockResolvedValue(
      makeWeatherBundle({
        district: makeDistrict({ slug: "masaka", name: "Masaka", coordinates: { lat: -0.33, lon: 31.7 } }),
        condition: { code: 1087, text: "Thundery outbreaks", icon: "", theme: "thunder" },
      }),
    );

    const res = await GET(new Request("http://localhost/api/v1/marine/lake-victoria?shore=masaka"));
    const body = await res.json();
    expect(body.data.fishingSafety.level).toBe("danger");
  });

  it("rejects unknown shoreline or zone parameters with 400", async () => {
    const res = await GET(new Request("http://localhost/api/v1/marine/lake-victoria?shore=unknown"));
    expect(res.status).toBe(400);

    const badZone = await GET(new Request("http://localhost/api/v1/marine/lake-victoria?zone=nairobi"));
    expect(badZone.status).toBe(400);
  });
});
